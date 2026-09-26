import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Homepage() {
    const [count, setCount] = useState(0);
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem("user") || "null");

    const goToProfile = () => {
        if (!user) return;
        navigate(`/profile/${user.id}`);
    };

    return (
        <div className="text-2xl">
            The count is: {count}
            <button onClick={() => setCount(count + 1)}>Add</button>

            <div style={{ marginTop: 16 }}>
                <button onClick={goToProfile}>Profile</button>
            </div>
        </div>
    );
}