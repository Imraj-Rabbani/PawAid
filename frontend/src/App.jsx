import {Routes, Route} from "react-router-dom"
import './App.css'
import Homepage from "./pages/Homepage"
import SignIn from "./pages/Signin"
import SignUp from "./pages/Signup"

function App() {


  return (
    <>
      <Routes>
        <Route path="/" element={<Homepage/>} />
        <Route path="/signin" element={<SignIn/>} />
        <Route path="/signup" element={<SignUp/>} />
      </Routes>
    </>
  )
}

export default App
