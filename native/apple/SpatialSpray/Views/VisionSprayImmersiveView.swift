import SwiftUI

#if os(visionOS)
import RealityKit
import UIKit

struct VisionSprayImmersiveView: View {
    @EnvironmentObject private var session: SpraySessionStore

    var body: some View {
        RealityView { content, attachments in
            let root = Entity()
            root.name = "SpatialSprayRoot"
            content.add(root)

            let wall = makeSprayWall()
            wall.position = [0, 1.25, -1.45]
            root.addChild(wall)

            if let panel = attachments.entity(for: "nearby-panel") {
                panel.position = [0.75, 1.35, -1.1]
                root.addChild(panel)
            }
        } attachments: {
            Attachment(id: "nearby-panel") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Nearby Spray")
                        .font(.title2)
                    ForEach(session.nearbySprays.prefix(6)) { spray in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(spray.title)
                            Text("@\(spray.username) · \(Int(spray.distanceMeters ?? 0))m")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .frame(width: 360, alignment: .leading)
                .padding()
                .glassBackgroundEffect()
                .onAppear {
                    session.loadNearby()
                }
            }
        }
    }

    private func makeSprayWall() -> Entity {
        let root = Entity()
        let wallMaterial = SimpleMaterial(color: UIColor(white: 0.18, alpha: 0.92), roughness: 0.9, isMetallic: false)
        let wall = ModelEntity(mesh: .generatePlane(width: 1.5, height: 0.9), materials: [wallMaterial])
        wall.name = "SprayPreviewWall"
        root.addChild(wall)

        let samples = session.nearbySprays.isEmpty ? sampleStrokes() : Array(session.nearbySprays.prefix(3)).flatMap(\.strokes)
        for (index, stroke) in samples.enumerated() {
            let strip = ModelEntity(
                mesh: .generatePlane(width: 0.16 + Float(index % 3) * 0.05, height: 0.08),
                materials: [SimpleMaterial(color: UIColor(hex: stroke.color), roughness: 0.85, isMetallic: false)]
            )
            strip.position = [Float(index % 4) * 0.22 - 0.35, Float(index / 4) * 0.16 - 0.12, 0.006]
            root.addChild(strip)
        }

        return root
    }

    private func sampleStrokes() -> [SprayStroke] {
        [
            SprayBrushModel.makeStroke(id: "vision-sample-red", color: "#ef4444", nozzle: "fat-cap", points: [
                SprayPoint(x: 0.25, y: 0.4, z: 0, pressure: 0.8, timestampMs: 0)
            ]),
            SprayBrushModel.makeStroke(id: "vision-sample-blue", color: "#38bdf8", nozzle: "soft-cap", points: [
                SprayPoint(x: 0.45, y: 0.5, z: 0, pressure: 0.7, timestampMs: 0)
            ]),
            SprayBrushModel.makeStroke(id: "vision-sample-green", color: "#22c55e", nozzle: "skinny-cap", points: [
                SprayPoint(x: 0.62, y: 0.35, z: 0, pressure: 0.6, timestampMs: 0)
            ])
        ]
    }
}

private extension UIColor {
    convenience init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let value = Int(cleaned, radix: 16) ?? 0xef4444
        self.init(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 0.9
        )
    }
}
#endif
