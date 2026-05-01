import { PolicyScreen } from "../../src/components/common/PolicyScreen";

export default function TermsScreen() {
  return (
    <PolicyScreen
      title="Terms of Service"
      summary="These beta terms explain the ground rules for using Ballpark Ledger before public launch. They are placeholder product terms and need legal review."
      sections={[
        {
          title: "Acceptable use",
          body: [
            "Use the app for personal sports attendance logging, reasonable beta testing, and related feedback. Do not use the app to abuse the service, interfere with other users, probe for unauthorized access, or upload content you do not have the right to enter."
          ]
        },
        {
          title: "Beta status",
          body: [
            "This is a private beta. Features, storage behavior, and data models may change. The service may be interrupted, reset, or updated without notice while the product is still being stabilized."
          ]
        },
        {
          title: "Accuracy and affiliation",
          body: [
            "The app may include historical game references and derived stats, but no guarantee is made that those records are complete or perfectly accurate. Ballpark Ledger is not affiliated with MLB, any MLB club, or any stadium operator unless that changes in the future and is stated clearly."
          ]
        },
        {
          title: "Content ownership",
          body: [
            "You keep ownership of the notes, memories, and other content you enter. The app owner keeps ownership of the software, design, branding, and underlying product IP. By using the beta, you allow the service to store and process the content you submit so the product can function."
          ]
        }
      ]}
    />
  );
}

