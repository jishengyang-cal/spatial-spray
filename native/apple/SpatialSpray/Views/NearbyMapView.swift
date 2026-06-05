import MapKit
import SwiftUI

struct NearbyMapView: View {
    @EnvironmentObject private var session: SpraySessionStore

    private let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)

    var body: some View {
        VStack(spacing: 0) {
            Map {
                Marker("You", coordinate: coordinate)
                ForEach(session.clusters) { cluster in
                    Annotation("\(cluster.count)", coordinate: CLLocationCoordinate2D(latitude: cluster.center.latitude, longitude: cluster.center.longitude)) {
                        Text("\(cluster.count)")
                            .font(.caption.bold())
                            .padding(8)
                            .background(.blue.opacity(0.8), in: Circle())
                            .foregroundStyle(.white)
                    }
                }
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
                .swipeActions(edge: .trailing) {
                    Button("Report", role: .destructive) {
                        session.report(spray)
                    }
                    Button("Block") {
                        session.block(spray)
                    }
                }
                .swipeActions(edge: .leading) {
                    if spray.ownerUserId == session.user?.id {
                        Button("Delete", role: .destructive) {
                            session.delete(spray)
                        }
                    }
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
