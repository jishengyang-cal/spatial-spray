import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SpraySessionStore

    var body: some View {
        VStack(spacing: 16) {
            ForEach(AuthProvider.allCases) { provider in
                Button("Continue with \(provider.rawValue.capitalized)") {
                    session.login(provider: provider)
                }
                .buttonStyle(.borderedProminent)
            }

            if let error = session.errorMessage {
                Text(error)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

