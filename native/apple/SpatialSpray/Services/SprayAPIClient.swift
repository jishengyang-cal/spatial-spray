import Foundation

enum SprayAPIError: Error {
    case invalidURL
    case invalidResponse
}

final class SprayAPIClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(baseURL: URL = URL(string: "http://127.0.0.1:4301")!, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func devLogin(provider: AuthProvider) async throws -> AuthResponse {
        let request = AuthRequest(
            provider: provider,
            providerSubject: "\(provider.rawValue)-native-user",
            displayName: "\(provider.rawValue.capitalized) User",
            devicePlatform: devicePlatform
        )
        return try await post("/auth/dev-login", body: request)
    }

    func refresh(refreshToken: String) async throws -> RefreshSessionResponse {
        try await post("/auth/refresh", body: RefreshSessionRequest(refreshToken: refreshToken))
    }

    func claimUsername(_ username: String, token: String) async throws -> ClaimUsernameResponse {
        try await post("/users/username", body: ClaimUsernameRequest(username: username), token: token)
    }

    func nearby(latitude: Double, longitude: Double, token: String?) async throws -> NearbySpraysResponse {
        let path = "/sprays/nearby?lat=\(latitude)&lng=\(longitude)&radiusMeters=1200"
        return try await get(path, token: token)
    }

    func clusters(latitude: Double, longitude: Double, token: String?) async throws -> SprayClustersResponse {
        let path = "/sprays/clusters?lat=\(latitude)&lng=\(longitude)&radiusMeters=1200&cellMeters=180"
        return try await get(path, token: token)
    }

    func createSpray(_ request: CreateSprayPieceRequest, token: String) async throws -> CreateSprayPieceResponse {
        try await post("/sprays", body: request, token: token)
    }

    func setSprayVisibility(id: String, visibility: String, token: String) async throws -> SetSprayVisibilityResponse {
        try await post("/sprays/\(id)/visibility", body: SetSprayVisibilityRequest(visibility: visibility), token: token)
    }

    func reportSpray(id: String, token: String) async throws -> ReportSprayResponse {
        try await post("/sprays/\(id)/reports", body: ReportSprayRequest(reason: "other", note: "native report"), token: token)
    }

    func blockUser(id: String, token: String) async throws -> BlockUserResponse {
        try await post("/blocks", body: BlockUserRequest(blockedUserId: id), token: token)
    }

    func deleteSpray(id: String, token: String) async throws {
        try await delete("/sprays/\(id)", token: token)
    }

    private var devicePlatform: String {
        #if os(visionOS)
        return "visionos"
        #else
        return "iphone"
        #endif
    }

    private func get<T: Decodable>(_ path: String, token: String? = nil) async throws -> T {
        var request = URLRequest(url: try makeURL(path))
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Encodable, R: Decodable>(_ path: String, body: T, token: String? = nil) async throws -> R {
        var request = URLRequest(url: try makeURL(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(R.self, from: data)
    }

    private func delete(_ path: String, token: String? = nil) async throws {
        var request = URLRequest(url: try makeURL(path))
        request.httpMethod = "DELETE"
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        let (_, response) = try await session.data(for: request)
        try validate(response)
    }

    private func makeURL(_ path: String) throws -> URL {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw SprayAPIError.invalidURL
        }
        return url
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SprayAPIError.invalidResponse
        }
    }
}

@MainActor
final class SpraySessionStore: ObservableObject {
    @Published var token: String?
    @Published var refreshToken: String?
    @Published var user: UserProfile?
    @Published var nearbySprays: [SprayPiece] = []
    @Published var clusters: [SprayCluster] = []
    @Published var errorMessage: String?

    private let client = SprayAPIClient()

    func login(provider: AuthProvider) {
        Task {
            do {
                let response = try await client.devLogin(provider: provider)
                token = response.token
                refreshToken = response.refreshToken
                user = response.user
                errorMessage = nil
            } catch {
                errorMessage = "Sign in failed"
            }
        }
    }

    func claimUsername(_ username: String) {
        guard let token else { return }
        Task {
            do {
                let response = try await client.claimUsername(username, token: token)
                user = response.user
                errorMessage = nil
            } catch {
                errorMessage = "Username unavailable"
            }
        }
    }

    func loadNearby(latitude: Double = 37.7749, longitude: Double = -122.4194) {
        Task {
            do {
                async let nearbyResponse = client.nearby(latitude: latitude, longitude: longitude, token: token)
                async let clusterResponse = client.clusters(latitude: latitude, longitude: longitude, token: token)
                let nearby = try await nearbyResponse
                let clusterPayload = try await clusterResponse
                nearbySprays = nearby.sprays
                clusters = clusterPayload.clusters
                errorMessage = nil
            } catch {
                errorMessage = "Nearby lookup failed"
            }
        }
    }

    func publishSpray(title: String, geo: GeoPoint, anchor: AnchorRef, strokes: [SprayStroke], visibility: String = "public") {
        guard let token else { return }
        Task {
            do {
                let request = CreateSprayPieceRequest(
                    title: title,
                    geo: geo,
                    anchor: anchor,
                    strokes: strokes,
                    visibility: visibility,
                    previewImageUrl: nil
                )
                _ = try await client.createSpray(request, token: token)
                loadNearby(latitude: geo.latitude, longitude: geo.longitude)
                errorMessage = nil
            } catch {
                errorMessage = "Spray publish failed"
            }
        }
    }

    func setVisibility(_ spray: SprayPiece, visibility: String) {
        guard let token else { return }
        Task {
            do {
                let response = try await client.setSprayVisibility(id: spray.id, visibility: visibility, token: token)
                if let index = nearbySprays.firstIndex(where: { $0.id == spray.id }) {
                    nearbySprays[index] = response.spray
                }
                loadNearby(latitude: spray.geo.latitude, longitude: spray.geo.longitude)
                errorMessage = nil
            } catch {
                errorMessage = "Visibility update failed"
            }
        }
    }

    func report(_ spray: SprayPiece) {
        guard let token else { return }
        Task {
            do {
                _ = try await client.reportSpray(id: spray.id, token: token)
                errorMessage = nil
            } catch {
                errorMessage = "Report failed"
            }
        }
    }

    func block(_ spray: SprayPiece) {
        guard let token else { return }
        Task {
            do {
                _ = try await client.blockUser(id: spray.ownerUserId, token: token)
                nearbySprays.removeAll { $0.ownerUserId == spray.ownerUserId }
                errorMessage = nil
            } catch {
                errorMessage = "Block failed"
            }
        }
    }

    func delete(_ spray: SprayPiece) {
        guard let token else { return }
        Task {
            do {
                try await client.deleteSpray(id: spray.id, token: token)
                nearbySprays.removeAll { $0.id == spray.id }
                errorMessage = nil
            } catch {
                errorMessage = "Delete failed"
            }
        }
    }
}
