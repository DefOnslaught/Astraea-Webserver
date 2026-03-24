import { useNavigate } from "react-router-dom";
import useDocumentTitle from "../../utils/useDocumentTitle";

const MustBeLoggedIn = () => {
    useDocumentTitle('Create an Account or Login | Astraea');
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen flex-col justify-center items-center px-6 lg:px-8 text-center">

            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                User account needed
            </h1>

            <p className="mt-6 text-lg font-medium text-gray-400 sm:text-xl/8">
                Sorry, you must be logged in to view this page.
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-6">
                {/* Primary Action */}
                <button
                    onClick={() => navigate("/")}
                    className="rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-all"
                >
                    Go back home
                </button>

                {/* Secondary Action */}
                <button
                    onClick={() => window.history.back()}
                    className="text-sm font-semibold text-gray-300 hover:text-white"
                >
                    Previous Page <span aria-hidden="true">&rarr;</span>
                </button>
            </div>

            {/* Subtle decorative background element */}
            <div className="absolute -z-10 blur-3xl opacity-20 pointer-events-none">
                <div className="h-64 w-64 bg-indigo-500 rounded-full"></div>
            </div>
        </div>
    );
};

export default MustBeLoggedIn;