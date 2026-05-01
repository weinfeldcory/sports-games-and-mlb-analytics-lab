import { PolicyScreen } from "../../src/components/common/PolicyScreen";

export default function PrivacyScreen() {
  return (
    <PolicyScreen
      title="Privacy Policy"
      summary="This policy explains in plain English what the beta may store about your account and attendance record. It is a placeholder privacy policy and needs attorney review."
      sections={[
        {
          title: "What account data may be collected",
          body: [
            "If you use hosted accounts, the app may store your email address, display name, profile preferences, and sign-in related account identifiers. If you use local-only mode, your account data stays on the current device or browser."
          ]
        },
        {
          title: "What attendance data may be stored",
          body: [
            "The app may store the games you log, the teams and venue tied to each game, your attended date, seat details, witnessed events, and derived attendance statistics based on those records."
          ]
        },
        {
          title: "Notes and memories",
          body: [
            "If you enter a memorable moment, companion name, giveaway note, weather note, or similar free-form memory, that user-generated content may be stored with your attendance log."
          ]
        },
        {
          title: "Affiliation and data handling",
          body: [
            "Ballpark Ledger is not affiliated with MLB or any MLB club unless that changes and is stated explicitly. Historical game references may come from third-party or public sports data sources, and those records should not be treated as official league data."
          ]
        },
        {
          title: "Deletion requests",
          body: [
            "If you want your hosted beta account or stored attendance records deleted, contact the app owner directly and include the email address used for the beta account. Before broader release, this process should be replaced with a clearer in-app or documented deletion workflow."
          ]
        }
      ]}
    />
  );
}

