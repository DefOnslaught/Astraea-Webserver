import { useState, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

const ActionDropdown = ({ isOpen, onClose, anchorRef, children }) => {
    const [coords, setCoords] = useState(null);
    const menuRef = useRef(null);

    useLayoutEffect(() => {
        const updatePosition = () => {
            if (isOpen && anchorRef.current) {
                const rect = anchorRef.current.getBoundingClientRect();

                // We use a temporary render or estimated constants
                const menuWidth = 160;
                const menuHeight = 110;
                const margin = 8;

                const spaceBelow = window.innerHeight - rect.bottom;
                const showUpward = spaceBelow < menuHeight + margin;

                setCoords({
                    // window.scrollY ensures position stays correct even if page is scrolled
                    top: showUpward
                        ? rect.top + window.scrollY - menuHeight - margin
                        : rect.bottom + window.scrollY + margin,
                    left: rect.right + window.scrollX - menuWidth,
                    showUpward
                });
            } else {
                setCoords(null);
            }
        };
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        updatePosition();

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, anchorRef]);

    // Handle Click Outside
    useLayoutEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) &&
                !anchorRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [isOpen, onClose, anchorRef]);

    // PREVENT TELEPORT: Do not render the portal at all until coords are calculated
    if (!isOpen || !coords) return null;

    return createPortal(
        <div
            ref={menuRef}
            style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                position: 'absolute',
            }}
            // Now that we only render when coords exist, the animation 
            // starts exactly at the intended location.
            className={`w-40 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden 
                animate-in fade-in zoom-in-95 duration-200 
                ${coords.showUpward ? "slide-in-from-bottom-2 origin-bottom" : "slide-in-from-top-2 origin-top"}`}
        >
            <div className="flex flex-col py-1">
                {children}
            </div>
        </div>,
        document.body
    );
};

export default ActionDropdown;