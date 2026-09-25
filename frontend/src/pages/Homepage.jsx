import { useState } from "react";

export default function Homepage(){
    const [count, setCount] = useState(0)

    return(
        <div className="text-2xl">
            The count is: {count}
            <button onClick={()=>{
                setCount(count + 1)
            }}>Add</button>
        </div>
        
    )
}