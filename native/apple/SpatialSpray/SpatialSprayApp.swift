import SwiftUI

@main
struct SpatialSprayApp: App {
    @StateObject private var session = SpraySessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }

        #if os(visionOS)
        ImmersiveSpace(id: "SprayImmersiveSpace") {
            VisionSprayImmersiveView()
                .environmentObject(session)
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed)
        #endif
    }
}

