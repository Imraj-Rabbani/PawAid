import {Routes, Route} from "react-router-dom"
import './App.css'
import Homepage from "./pages/Homepage"
import SignIn from "./pages/Signin"
import SignUp from "./pages/Signup"
import ProfilePage from "./pages/ProfilePage"
import AdminPage from "./pages/AdminPage"
import VolunteersPage from "./pages/VolunteersPage"
import VolunteerProfilePage from "./pages/VolunteerProfilePage"
import DonationsPage from "./pages/DonationsPage"
import TransparencyPage from "./pages/TransparencyPage"
import NotFound from "./pages/NotFound"

function App() {


  return (
    <>
      <Routes>
        <Route path="/" element={<Homepage/>} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/volunteers" element={<VolunteersPage />} />
        <Route path="/volunteers/:volunteerId" element={<VolunteerProfilePage />} />
        <Route path="/donations" element={<DonationsPage />} />
        <Route path="/transparency" element={<TransparencyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/signin" element={<SignIn/>} />
        <Route path="/signup" element={<SignUp/>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

export default App
