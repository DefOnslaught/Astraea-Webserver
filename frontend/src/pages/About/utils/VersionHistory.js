const VersionHistory = [
    {
        version: "v1.0.13",
        date: "August 13, 2026",
        changes: [
            "Fixed a typo made in the URL to download the Astraea Agent update.",
            "Made it so after a successful attempt at downloading the agent, the menu closes.",
            "Updated React dependencies."
        ]
    },
    {
        version: "v1.0.12",
        date: "August 12, 2026",
        changes: [
            "Fixed an error with stale Redis connections on the admin page.",
            "Increased the Maintenance window of Zabbix from 3 minutes to 10 to avoid false alerts from Zabbix."
        ]
    },
    {
        version: "v1.0.11",
        date: "July 30, 2026",
        changes: [
            "Modified redis configuration file on 'setup.sh'.",
            "Improved how 'update.sh' handles roll-backs."
        ]
    },
    {
        version: "v1.0.10",
        date: "July 29, 2026",
        changes: [
            "Forgot to add 'start-docker.sh' in the 'update-docker.sh' script."
        ]
    },
    {
        version: "v1.0.9",
        date: "July 29, 2026",
        changes: [
            "Correctly supporting Zabbix Server 6.x and 7.x.",
            "Fixed the docker deployment configuration.",
            "Implemented the 'update-docker.sh' script to handle update releases.",
            "Updated dependencies used by both Django and React."
        ]
    },
    {
        version: "v1.0.8",
        date: "July 27, 2026",
        changes: [
            "Fixed a bug with registering a server not sending notifications."
        ]
    },
    {
        version: "v1.0.7",
        date: "July 18, 2026",
        changes: [
            "Ensured the Django Admin Panel included all available options.",
            "Tidied up this Version history section.",
            "Improved the 'Search Guide' within Patch History of a server."
        ]
    },
    {
        version: "v1.0.6",
        date: "July 16, 2026",
        changes: [
            "Improved the error output of the command 'wait_for_db' to hopefully make the initial setup process easier."
        ]
    },
    {
        version: "v1.0.5",
        date: "July 15, 2026",
        changes: [
            "Removed emojis from scripts - Could cause issues",
            "Expanded Notification Event Triggers to include: Server Add, Delete, Modify, and check for website updates."
        ]
    },
    {
        version: "v1.0.0",
        date: "July 14, 2026",
        changes: [
            "Initial open-source release.",
            "Included this About page."
        ]
    }
];

export default VersionHistory;