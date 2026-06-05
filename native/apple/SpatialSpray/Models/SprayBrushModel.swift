import Foundation
import simd

struct SprayDecalVertex {
    var position: SIMD3<Float>
    var uv: SIMD2<Float>
    var alpha: Float
}

struct SprayDecalMesh {
    var vertices: [SprayDecalVertex]
    var indices: [UInt32]
    var color: String
    var roughness: Float
    var metallic: Float
}

enum SprayBrushModel {
    static func nozzleProfile(_ nozzle: String) -> (radiusMeters: Double, opacity: Double, overspray: Double, drip: Double) {
        switch nozzle {
        case "skinny-cap":
            return (0.018, 0.74, 0.35, 0.08)
        case "fat-cap":
            return (0.065, 0.62, 0.78, 0.18)
        case "drip":
            return (0.044, 0.82, 0.42, 0.72)
        default:
            return (0.038, 0.68, 0.56, 0.15)
        }
    }

    static func makeStroke(id: String, color: String, nozzle: String, points: [SprayPoint]) -> SprayStroke {
        let profile = nozzleProfile(nozzle)
        return SprayStroke(
            id: id,
            color: color,
            radiusMeters: profile.radiusMeters,
            opacity: profile.opacity,
            nozzle: nozzle,
            overspray: profile.overspray,
            drip: profile.drip,
            points: points
        )
    }

    static func distanceAttenuatedRadius(baseRadius: Double, sprayDistanceMeters: Double) -> Double {
        let clamped = min(1.2, max(0.12, sprayDistanceMeters))
        return baseRadius * (0.65 + clamped * 0.55)
    }

    static func wallAbsorptionOpacity(opacity: Double, wallRoughness: Double) -> Double {
        let roughness = min(1.0, max(0.0, wallRoughness))
        return opacity * (0.72 + roughness * 0.28)
    }

    static func createDecalMesh(
        from stroke: SprayStroke,
        surfaceOrigin: SIMD3<Float>,
        surfaceRight: SIMD3<Float>,
        surfaceUp: SIMD3<Float>,
        widthMeters: Float,
        heightMeters: Float,
        wallRoughness: Double = 0.55,
        sprayDistanceMeters: Double = 0.45
    ) -> SprayDecalMesh {
        var vertices: [SprayDecalVertex] = []
        var indices: [UInt32] = []
        let wallOpacity = wallAbsorptionOpacity(opacity: stroke.opacity, wallRoughness: wallRoughness)
        let radius = Float(distanceAttenuatedRadius(baseRadius: stroke.radiusMeters, sprayDistanceMeters: sprayDistanceMeters))

        for point in stroke.points {
            let center = surfaceOrigin
                + surfaceRight * Float((point.x - 0.5) * Double(widthMeters))
                + surfaceUp * Float((0.5 - point.y) * Double(heightMeters))
            let right = surfaceRight * radius
            let up = surfaceUp * radius
            let base = UInt32(vertices.count)
            let alpha = Float(min(1.0, max(0.05, point.pressure * wallOpacity)))

            vertices.append(SprayDecalVertex(position: center - right - up, uv: SIMD2(0, 1), alpha: alpha))
            vertices.append(SprayDecalVertex(position: center - up + right, uv: SIMD2(1, 1), alpha: alpha))
            vertices.append(SprayDecalVertex(position: center + right + up, uv: SIMD2(1, 0), alpha: alpha))
            vertices.append(SprayDecalVertex(position: center - right + up, uv: SIMD2(0, 0), alpha: alpha))
            indices.append(contentsOf: [base, base + 1, base + 2, base, base + 2, base + 3])
        }

        return SprayDecalMesh(vertices: vertices, indices: indices, color: stroke.color, roughness: 0.86, metallic: 0)
    }
}
