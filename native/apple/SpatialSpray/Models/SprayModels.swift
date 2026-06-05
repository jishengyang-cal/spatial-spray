import Foundation

enum AuthProvider: String, Codable, CaseIterable, Identifiable {
    case apple
    case google
    case facebook

    var id: String { rawValue }
}

struct UserProfile: Codable, Identifiable {
    let id: String
    let provider: AuthProvider
    let providerSubject: String
    let displayName: String
    var username: String?
    let createdAt: String
}

struct GeoPoint: Codable {
    var latitude: Double
    var longitude: Double
    var altitudeMeters: Double?
    var horizontalAccuracyMeters: Double?
}

struct SurfacePose: Codable {
    var position: [Double]
    var normal: [Double]
    var yawDegrees: Double
    var pitchDegrees: Double
    var rollDegrees: Double
}

struct AnchorRef: Codable {
    var provider: String
    var id: String?
    var payload: [String: String]?
    var surfacePose: SurfacePose
}

struct SprayPoint: Codable {
    var x: Double
    var y: Double
    var z: Double
    var pressure: Double
    var timestampMs: Double
}

struct SprayStroke: Codable, Identifiable {
    var id: String
    var color: String
    var radiusMeters: Double
    var opacity: Double
    var nozzle: String
    var overspray: Double
    var drip: Double
    var points: [SprayPoint]
}

struct SprayPiece: Codable, Identifiable {
    let id: String
    let ownerUserId: String
    let username: String
    let title: String
    let geo: GeoPoint
    let geohash: String
    let anchor: AnchorRef
    let strokes: [SprayStroke]
    let visibility: String
    let moderationStatus: String
    let createdAt: String
    let updatedAt: String
    let previewImageUrl: String?
    let distanceMeters: Double?
}

struct AuthRequest: Codable {
    let provider: AuthProvider
    let providerSubject: String
    let displayName: String
    let devicePlatform: String
}

struct AuthResponse: Codable {
    let token: String
    let refreshToken: String?
    let user: UserProfile
}

struct RefreshSessionRequest: Codable {
    let refreshToken: String
}

struct RefreshSessionResponse: Codable {
    let token: String
    let refreshToken: String
}

struct ClaimUsernameRequest: Codable {
    let username: String
}

struct ClaimUsernameResponse: Codable {
    let user: UserProfile
}

struct NearbySpraysResponse: Codable {
    let sprays: [SprayPiece]
}

struct SprayCluster: Codable, Identifiable {
    let id: String
    let center: GeoPoint
    let count: Int
    let sampleSprayIds: [String]
    let distanceMeters: Double
}

struct SprayClustersResponse: Codable {
    let clusters: [SprayCluster]
}

struct CreateSprayPieceRequest: Codable {
    let title: String
    let geo: GeoPoint
    let anchor: AnchorRef
    let strokes: [SprayStroke]
    let visibility: String
    let previewImageUrl: String?
}

struct CreateSprayPieceResponse: Codable {
    let spray: SprayPiece
}

struct ReportSprayRequest: Codable {
    let reason: String
    let note: String?
}

struct ReportSprayResponse: Codable {
    let moderationStatus: String
}

struct BlockUserRequest: Codable {
    let blockedUserId: String
}

struct BlockUserResponse: Codable {
    let blockedUserId: String
}
