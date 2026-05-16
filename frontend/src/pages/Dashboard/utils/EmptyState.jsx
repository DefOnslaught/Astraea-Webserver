import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";

const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-12">
        <FontAwesomeIcon icon={faFolderOpen} className="text-gray-700 text-2xl mb-2" />
        <p className="text-xs text-gray-500">{message}</p>
    </div>
);

export default EmptyState;