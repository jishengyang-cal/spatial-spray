import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SpraySessionStore

    var body: some View {
        NavigationStack {
            Group {
                if session.user == nil {
                    LoginView()
                } else if session.user?.username == nil {
                    UsernameView()
                } else {
                    NearbyMapView()
                }
            }
            .navigationTitle("Spatial Spray")
        }
    }
}

#Preview {
    RootView()
        .environmentObject(SpraySessionStore())
}

