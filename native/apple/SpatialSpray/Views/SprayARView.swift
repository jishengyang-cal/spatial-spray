import SwiftUI

#if canImport(ARKit) && !os(visionOS)
import ARKit
import RealityKit
import UIKit

struct SprayARView: View {
    @EnvironmentObject private var session: SpraySessionStore
    @State private var points: [SprayPoint] = []
    @State private var selectedColor = "#ef4444"
    @State private var nozzle = "soft-cap"
    @State private var visibility = "public"

    private let geo = GeoPoint(latitude: 37.7749, longitude: -122.4194, altitudeMeters: nil, horizontalAccuracyMeters: 10)

    var body: some View {
        ZStack(alignment: .bottom) {
            ARSprayCanvasView(color: selectedColor) { point in
                points.append(point)
            }
            .ignoresSafeArea()

            VStack(spacing: 12) {
                HStack {
                    ForEach(["#ef4444", "#f97316", "#22c55e", "#38bdf8", "#a855f7"], id: \.self) { color in
                        Button {
                            selectedColor = color
                        } label: {
                            Circle()
                                .fill(Color(hex: color))
                                .frame(width: 28, height: 28)
                                .overlay(Circle().stroke(selectedColor == color ? .white : .clear, lineWidth: 3))
                        }
                    }
                }

                HStack {
                    Picker("Nozzle", selection: $nozzle) {
                        Text("Soft").tag("soft-cap")
                        Text("Fat").tag("fat-cap")
                        Text("Skinny").tag("skinny-cap")
                        Text("Drip").tag("drip")
                    }
                    .pickerStyle(.segmented)
                }

                Picker("Visibility", selection: $visibility) {
                    Text("Everyone").tag("public")
                    Text("Only me").tag("private")
                }
                .pickerStyle(.segmented)

                HStack {
                    Button("Publish") {
                        publish()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(points.isEmpty || session.user?.username == nil)
                }
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
            .padding()
        }
        .navigationTitle("Spray")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func publish() {
        let stroke = SprayBrushModel.makeStroke(id: UUID().uuidString, color: selectedColor, nozzle: nozzle, points: points)
        let anchor = AnchorRef(
            provider: "manual-local",
            id: nil,
            payload: nil,
            surfacePose: SurfacePose(
                position: [0, 1.4, -1.2],
                normal: [0, 0, 1],
                yawDegrees: 0,
                pitchDegrees: 0,
                rollDegrees: 0
            )
        )
        session.publishSpray(
            title: "Spray by @\(session.user?.username ?? "artist")",
            geo: geo,
            anchor: anchor,
            strokes: [stroke],
            visibility: visibility
        )
        points.removeAll()
    }
}

private struct ARSprayCanvasView: UIViewRepresentable {
    let color: String
    let onPoint: (SprayPoint) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(color: color, onPoint: onPoint)
    }

    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero)
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
        }
        view.session.run(configuration)

        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        view.addGestureRecognizer(pan)
        context.coordinator.view = view
        return view
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        context.coordinator.color = color
        context.coordinator.onPoint = onPoint
    }

    final class Coordinator: NSObject {
        weak var view: ARView?
        var color: String
        var onPoint: (SprayPoint) -> Void

        init(color: String, onPoint: @escaping (SprayPoint) -> Void) {
            self.color = color
            self.onPoint = onPoint
        }

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let view else { return }
            let location = gesture.location(in: view)
            guard gesture.state == .began || gesture.state == .changed else { return }

            let results = view.raycast(from: location, allowing: .estimatedPlane, alignment: .any)
            guard let result = results.first else { return }
            let position = SIMD3<Float>(
                result.worldTransform.columns.3.x,
                result.worldTransform.columns.3.y,
                result.worldTransform.columns.3.z
            )
            addPaintDot(at: position, in: view)

            let point = SprayPoint(
                x: max(0, min(1, Double(location.x / max(1, view.bounds.width)))),
                y: max(0, min(1, Double(location.y / max(1, view.bounds.height)))),
                z: 0,
                pressure: 0.7,
                timestampMs: Date().timeIntervalSince1970 * 1000
            )
            onPoint(point)
        }

        private func addPaintDot(at position: SIMD3<Float>, in view: ARView) {
            let mesh = MeshResource.generateSphere(radius: 0.018)
            let material = SimpleMaterial(color: UIColor(hex: color), isMetallic: false)
            let entity = ModelEntity(mesh: mesh, materials: [material])
            let anchor = AnchorEntity(world: position)
            anchor.addChild(entity)
            view.scene.addAnchor(anchor)
        }
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
            alpha: 1
        )
    }
}

private extension Color {
    init(hex: String) {
        self.init(uiColor: UIColor(hex: hex))
    }
}
#else
struct SprayARView: View {
    var body: some View {
        Text("AR spray creation requires ARKit on iPhone hardware.")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
#endif
