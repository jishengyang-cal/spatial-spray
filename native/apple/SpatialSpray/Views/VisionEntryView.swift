import SwiftUI

#if os(visionOS)
struct VisionEntryView: View {
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var isOpen = false

    var body: some View {
        Button(isOpen ? "Close Immersive Spray" : "Open Immersive Spray") {
            Task {
                if isOpen {
                    await dismissImmersiveSpace()
                    isOpen = false
                } else {
                    let result = await openImmersiveSpace(id: "SprayImmersiveSpace")
                    if case .opened = result {
                        isOpen = true
                    }
                }
            }
        }
        .buttonStyle(.borderedProminent)
    }
}
#endif

