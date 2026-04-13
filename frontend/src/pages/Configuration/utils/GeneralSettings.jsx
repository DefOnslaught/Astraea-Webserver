import { useState, useEffect } from "react";
import { ShieldCheck, Save, AlertTriangle, RefreshCw, Skull, Loader2 } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const GeneralSettings = ({ triggerSuccess, setError }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

    const [systemSettings, setSystemSettings] = useState({
        patchingEnabled: true,
        skipEmailValidation: false,
        disableRegistration: false,
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.SYSTEM_CONFIG);
                setSystemSettings({
                    patchingEnabled: res.data.patching_enabled,
                    skipEmailValidation: res.data.skip_email_validation,
                    disableRegistration: res.data.disable_registration,
                });
            } catch (err) {
                setError("Failed to load system settings.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveSystemSettings = async () => {
        setIsSaving(true);
        try {
            const payload = {
                data: {
                    patching_enabled: systemSettings.patchingEnabled,
                    skip_email_validation: systemSettings.skipEmailValidation,
                    disable_registration: systemSettings.disableRegistration,
                }
            };
            await api.patch(API_ENDPOINTS.SYSTEM_CONFIG, payload);
            triggerSuccess("System settings updated successfully.");
        } catch (err) {
            setError("Failed to update settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePurgeDatabase = async () => {
        setIsPurging(true);
        try {
            await api.post(API_ENDPOINTS.PURGE_OLD_PACKAGES);
            triggerSuccess("Orphaned package data purged.");
            setShowPurgeConfirm(false);
        } catch (err) {
            setError("Database purge failed.");
        } finally {
            setIsPurging(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-in fade-in slide-in-from-bottom-2">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Fetching System Config...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* System Controls Section */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" /> System Controls
                </h3>
                <div className="space-y-4">
                    {/* Global Patching Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-white/5">
                        <div>
                            <p className="text-sm font-medium text-white">Global Patching</p>
                            <p className="text-xs text-gray-400">Enable or disable the patching engine system-wide.</p>
                        </div>
                        <button
                            onClick={() => setSystemSettings({ ...systemSettings, patchingEnabled: !systemSettings.patchingEnabled })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${systemSettings.patchingEnabled ? 'bg-indigo-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${systemSettings.patchingEnabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Email Validation Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-white/5">
                        <div>
                            <p className="text-sm font-medium text-white">Skip Email Validation</p>
                            <p className="text-xs text-gray-400">Allow users to register without verifying their email address.</p>
                        </div>
                        <button
                            onClick={() => setSystemSettings({ ...systemSettings, skipEmailValidation: !systemSettings.skipEmailValidation })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${systemSettings.skipEmailValidation ? 'bg-indigo-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${systemSettings.skipEmailValidation ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Registration Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-white/5">
                        <div>
                            <p className="text-sm font-medium text-white">Disable User Registration</p>
                            <p className="text-xs text-gray-400">Disable the ability for creating new user accounts. Must be made in /administration/</p>
                        </div>
                        <button
                            onClick={() => setSystemSettings({ ...systemSettings, disableRegistration: !systemSettings.disableRegistration })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${systemSettings.disableRegistration ? 'bg-indigo-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${systemSettings.disableRegistration ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSaveSystemSettings}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save General Settings
                    </button>
                </div>
            </div>

            {/* Maintenance Mode */}
            <div className="mt-4 p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                    <Skull className="text-red-500/50 w-4 h-4" />
                    <h3 className="text-xs font-bold text-red-500/70 uppercase tracking-[0.2em]">Danger Zone</h3>
                </div>

                {!showPurgeConfirm ? (
                    <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-xl bg-red-500/5">
                        <div className="max-w-md">
                            <p className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" /> Purge Orphaned Packages
                            </p>
                            <p className="text-xs text-gray-500 leading-tight mt-1">
                                Permanently delete package definitions not linked to any active server. This improves database performance but is irreversible.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPurgeConfirm(true)}
                            className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all"
                        >
                            Purge
                        </button>
                    </div>
                ) : (
                    <div className="p-4 border border-red-500/40 rounded-xl bg-red-900/20 animate-in zoom-in-95 duration-200">
                        <p className="text-xs font-bold text-red-400 text-center mb-4 italic">
                            Wipe all unused package data?
                        </p>
                        <div className="flex gap-2 max-w-xs mx-auto">
                            <button
                                type="button"
                                onClick={() => setShowPurgeConfirm(false)}
                                className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handlePurgeDatabase}
                                disabled={isPurging}
                                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 shadow-lg shadow-red-900/40 disabled:opacity-50"
                            >
                                {isPurging ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : "Confirm Purge"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeneralSettings;