import SwiftUI

struct UsernameView: View {
    @EnvironmentObject private var session: SpraySessionStore
    @State private var username = ""

    var body: some View {
        Form {
            Section("Username") {
                TextField("unique_username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Button("Create Username") {
                    session.claimUsername(username)
                }
            }

            if let error = session.errorMessage {
                Text(error)
            }
        }
    }
}

