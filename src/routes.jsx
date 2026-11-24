import React from 'react'
import { BrowserRouter, Routes, Route} from "react-router";
import Home from './Pages/home';
import Preloader from './Pages/Preloader';
import PageLoader from './Components/Layout/PageLoader';
import Category from './Pages/Category';
import ProjectDetails from './Pages/ProjectDetails';


const PageRouter = () => {
    return ( 
        <BrowserRouter>
            {/* Preloader shows over every page on load and on each page change */}
            <PageLoader>
            <Routes>
                <Route path='/loading' element={<Preloader/>}/>
                <Route path='/' element={<Home />}/>
                <Route path='/category/:slug' element={<Category />}/>
                <Route path='/projects/:id' element={<ProjectDetails />}/>
            </Routes>
            </PageLoader>
        </BrowserRouter>
     );
}
 
export default PageRouter;