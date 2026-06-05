import SwiftUI

#if os(visionOS)
import RealityKit

struct VisionSprayImmersiveView: View {
    @EnvironmentObject private var session: SpraySessionStore

    var body: some View {
        RealityView { content, attachments in
            let root = Entity()
            root.name = "SpatialSprayRoot"
            content.add(root)

            if let panel = attachments.entity(for: "nearby-panel") {
                panel.position = [0, 1.35, -1.2]
                root.addChild(panel)
            }
        } attachments: {
            Attachment(id: "nearby-panel") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Nearby Spray")
                        .font(.title2)
                    ForEach(session.nearbySprays) { spray in
                        Text("\(spray.title) · \(Int(spray.distanceMeters ?? 0))m")
                    }
                }
                .padding()
                .glassBackgroundEffect()
                .onAppear {
                    session.loadNearby()
                }
            }
        }
    }
}
#endif

