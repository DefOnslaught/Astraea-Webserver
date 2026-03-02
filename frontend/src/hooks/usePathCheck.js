import { useLocation } from "react-router-dom";
import { PUBLIC_PATHS, AUTH_PAGES } from "../utils/constants";

export const usePathCheck = () => {
    const location = useLocation();
    const isPublicPage = PUBLIC_PATHS.some(path => location.pathname.startsWith(path));

    // Re-usable helper to check if current path starts with any in the array
    const checkPath = (pathList) =>
        pathList.some(path => location.pathname.startsWith(path));

    return {
        isPublicPage: checkPath(PUBLIC_PATHS),
        isAuthPage: checkPath(AUTH_PAGES),
        pathname: location.pathname
    };
};