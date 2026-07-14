import { Github, Code, GitBranch, ExternalLink, ShieldAlert, Heart } from "lucide-react";
import { GITHUB_REPO, VERSION } from "../../utils/constants";

const About = () => {

    const versionHistory = [
        {
            version: "v1.0.0",
            date: "July 2026",
            changes: [
                "Initial open-source release.",
                "Included this About page."
            ]
        }
    ];

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="mb-8 border-b border-white/5 pb-6">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    About <span className="text-indigo-500">Astraea</span>
                </h1>
                <p className="text-gray-400 mt-2">Open-source Linux patch management and telemetry.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Project Info & Links */}
                <div className="space-y-8 lg:col-span-1">

                    {/* System Info Card */}
                    <div className="bg-gray-800/30 border border-white/5 p-6 rounded-2xl relative overflow-hidden">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Code className="w-4 h-4 text-indigo-400" />
                            System Information
                        </h2>
                        <ul className="space-y-4 text-sm">
                            <li className="flex justify-between items-center border-b border-white/5 pb-3">
                                <span className="text-gray-400">Current Version</span>
                                <span className="text-indigo-400 font-mono font-medium bg-indigo-500/10 px-2 py-0.5 rounded">
                                    {VERSION}
                                </span>
                            </li>
                            <li className="flex justify-between items-center border-b border-white/5 pb-3">
                                <span className="text-gray-400">License</span>
                                <span className="text-gray-200">MIT</span>
                            </li>
                            <li className="flex justify-between items-center pb-1">
                                <span className="text-gray-400">Created by</span>
                                <span className="text-gray-200 font-medium flex items-center">
                                    DefOnslaught
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* Community & Support Card */}
                    <div className="bg-gray-800/30 border border-white/5 p-6 rounded-2xl relative overflow-hidden">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Github className="w-4 h-4 text-gray-400" />
                            Community & Support
                        </h2>
                        <div className="space-y-3">
                            <a
                                href={GITHUB_REPO}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm text-gray-200 group"
                            >
                                <span className="flex items-center gap-3">
                                    <GitBranch className="w-4 h-4 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                                    Source Code
                                </span>
                                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                            </a>
                            <a
                                href={`${GITHUB_REPO}/issues`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm text-gray-200 group"
                            >
                                <span className="flex items-center gap-3">
                                    <ShieldAlert className="w-4 h-4 text-red-400/70 group-hover:text-red-400 transition-colors" />
                                    Report a Bug
                                </span>
                                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                            </a>
                            <p className="text-xs text-gray-500 mt-6 text-center flex items-center justify-center">
                                Built with <Heart className="w-3 h-3 mx-1.5 text-red-500/70" /> for the homelab community.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Version History Timeline */}
                <div className="bg-gray-800/30 border border-white/5 p-6 md:p-8 rounded-2xl relative overflow-hidden lg:col-span-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-400" />
                        Version History
                    </h2>

                    {/* Left-Aligned Timeline */}
                    <div className="ml-2 border-l border-white/10 space-y-8">
                        {versionHistory.map((release, index) => (
                            <div key={release.version} className="relative pl-8">

                                {/* Timeline Dot */}
                                <div className="absolute -left-1.25 top-6 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-gray-900 z-10" />

                                {/* Content Box */}
                                <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-300 group">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-white/5 pb-4 gap-2">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-lg text-indigo-400">
                                                {release.version}
                                            </span>
                                            {index === 0 && (
                                                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-widest px-2 py-1 rounded">
                                                    Latest
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                                            {release.date}
                                        </span>
                                    </div>

                                    <ul className="space-y-2">
                                        {release.changes.map((change, i) => (
                                            <li key={i} className="flex items-start text-sm text-gray-300">
                                                <span className="text-indigo-500/50 mr-3 mt-0.5">•</span>
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default About;