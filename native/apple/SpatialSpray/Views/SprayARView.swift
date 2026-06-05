import SwiftUI

#if canImport(ARKit) && !os(visionOS)
import ARKit
import RealityKit

struct SprayARView: UIViewRepresentable {
    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero)
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }
        view.session.run(configuration)
        return view
    }

    func updateUIView(_ uiView: ARView, context: Context) {}
}
#else
struct SprayARView: View {
    var body: some View {
        Text("AR spray creation requires ARKit on device.")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
#endif

