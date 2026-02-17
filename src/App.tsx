import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AuthGate } from "./components/Auth/AuthGate";
import { BoardList } from "./components/Board/BoardList";
import { BoardView } from "./components/Board/BoardView";

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<BoardList />} />
            <Route path="/board/:boardId" element={<BoardView />} />
          </Routes>
        </BrowserRouter>
      </AuthGate>
    </AuthProvider>
  );
}

export default App;
