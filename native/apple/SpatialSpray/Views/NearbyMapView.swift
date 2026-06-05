import MapKit
import SwiftUI

struct NearbyMapView: View {
    @EnvironmentObject private var session: SpraySessionStore

    private let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)

    var body: some View {
        VStack(spacing: 0) {
            Map {
                Marker("You", coordinate: coordinate)
                ForEach(session.nearbySprays) { spray in
                    Marker(spray.title, coordinate: CLLocationCoordinate2D(latitude: spray.geo.latitude, longitude: spray.geo.longitude))
                }
            }

            List(session.nearbySprays) { spray in
                VStack(alignment: .leading) {
                    Text(spray.title)
                    Text("@\(spray.username) · \(Int(spray.distanceMeters ?? 0))m")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(height: 220)
        }
        .toolbar {
            NavigationLink("Spray") {
                SprayARView()
            }

            #if os(visionOS)
            NavigationLink("Immersive") {
                VisionEntryView()
            }
            #endif
        }
        .onAppear {
            session.loadNearby(latitude: coordinate.latitude, longitude: coordinate.longitude)
        }
    }
}

