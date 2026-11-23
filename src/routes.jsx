import React from 'react'
import { BrowserRouter, Routes, Route} from "react-router";
import Home from './Pages/home';


const PageRouter = () => {
    return ( 
        <BrowserRouter>
            <Routes>
                <Route path='/' element={<Home />}/>
            </Routes>
        </BrowserRouter>
     );
}
 
export default PageRouter;