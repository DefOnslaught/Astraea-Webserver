import { useState, useEffect, useMemo } from "react";
import { Server, Save, RefreshCw, Loader2, Key, Globe, AlertCircle } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const ZabbixSettings = ({ triggerSuccess, setError }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        enable: false,
        api_url: "",
        api_token: "",
    });

    // Derive validation state
    const validation = useMemo(() => {
        const urlValid = settings.api_url && settings.api_url.trim().length > 0;
        const tokenValid = settings.api_token && settings.api_token.trim().length > 0;

        return {
            isValid: !settings.enable || (urlValid && tokenValid),
            error: settings.enable && (!urlValid || !tokenValid)
                ? "API URL and Token are required when Zabbix integration is enabled."
                : null
        };
    }, [settings]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.ZABBIX_CONFIG);
                setSettings({
                    enable: res.data.enable,
                    api_url: res.data.api_url || "",
                    api_token: res.data.api_token || "",
                });
            } catch (err) {
                setError("Failed to load Zabbix settings.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        if (!validation.isValid) return;

        setIsSaving(true);
        try {
            const payload = { data: settings };
            await api.patch(API_ENDPOINTS.ZABBIX_CONFIG, payload);
            triggerSuccess("Zabbix settings updated successfully.");
        } catch (err) {
            setError("Failed to update Zabbix settings.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-in fade-in slide-in-from-bottom-2">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Fetching Zabbix Config...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Server className="w-5 h-5 text-indigo-400" /> Zabbix Integration
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-white/5">
                        <div>
                            <p className="text-sm font-medium text-white">Enable Zabbix Integration</p>
                            <p className="text-xs text-gray-400">Enable automatic maintenance window management.</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, enable: !settings.enable })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.enable ? 'bg-indigo-500' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enable ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 ml-1">Zabbix API URL</label>
                        <div className="flex items-center bg-gray-900/50 border border-white/5 rounded-xl px-4 py-3">
                            <Globe className="w-4 h-4 text-gray-500 mr-3" />
                            <input
                                type="url"
                                value={settings.api_url}
                                onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                                placeholder="http://zabbix.example.com/api_jsonrpc.php"
                                className="bg-transparent flex-1 text-sm text-white placeholder-gray-600 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 ml-1">API Token</label>
                        <div className="flex items-center bg-gray-900/50 border border-white/5 rounded-xl px-4 py-3">
                            <Key className="w-4 h-4 text-gray-500 mr-3" />
                            <input
                                type="password"
                                value={settings.api_token}
                                onChange={(e) => setSettings({ ...settings, api_token: e.target.value })}
                                placeholder="Enter Zabbix API token"
                                className="bg-transparent flex-1 text-sm text-white placeholder-gray-600 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {validation.error && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-amber-500 text-xs">
                        <AlertCircle className="w-4 h-4" />
                        {validation.error}
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !validation.isValid}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg 
                            ${!validation.isValid
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Zabbix Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ZabbixSettings;