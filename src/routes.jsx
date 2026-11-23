import React from 'react'
import { BrowserRouter, Routes, Route} from "react-router";
import Home from './Pages/home';
import Preloader from './Pages/Preloader';


const PageRouter = () => {
    return ( 
        <BrowserRouter>
            <Routes>
                <Route path='/loading' element={<Preloader/>}/>
                <Route path='/' element={<Home />}/>
            </Routes>
        </BrowserRouter>
     );
}
 
export default PageRouter;