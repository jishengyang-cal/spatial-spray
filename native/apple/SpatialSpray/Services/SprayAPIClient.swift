import Foundation

enum SprayAPIError: Error {
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

    func claimUsername(_ username: String, token: String) async throws -> ClaimUsernameResponse {
        try await post("/users/username", body: ClaimUsernameRequest(username: username), token: token)
    }

    func nearby(latitude: Double, longitude: Double, token: String?) async throws -> NearbySpraysResponse {
        let path = "/sprays/nearby?lat=\(latitude)&lng=\(longitude)&radiusMeters=1200"
        return try await get(path, token: token)
    }

    private var devicePlatform: String {
        #if os(visionOS)
        return "visionos"
        #else
        return "iphone"
        #endif
    }

    private func get<T: Decodable>(_ path: String, token: String? = nil) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }
        let (data, response) = try await session.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Encodable, R: Decodable>(_ path: String, body: T, token: String? = nil) async throws -> R {
        var request = URLRequest(url: baseURL.appending(path: path))
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

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SprayAPIError.invalidResponse
        }
    }
}

@MainActor
final class SpraySessionStore: ObservableObject {
    @Published var token: String?
    @Published var user: UserProfile?
    @Published var nearbySprays: [SprayPiece] = []
    @Published var errorMessage: String?

    private let client = SprayAPIClient()

    func login(provider: AuthProvider) {
        Task {
            do {
                let response = try await client.devLogin(provider: provider)
                token = response.token
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
                let response = try await client.nearby(latitude: latitude, longitude: longitude, token: token)
                nearbySprays = response.sprays
                errorMessage = nil
            } catch {
                errorMessage = "Nearby lookup failed"
            }
        }
    }
}

