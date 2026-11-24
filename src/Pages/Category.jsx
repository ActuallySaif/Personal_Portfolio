import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import './Category.css';
import CategoryVoid from '../Components/Void/CategoryVoid';
import { usePageHold } from '../Components/Layout/PageLoader';
import { categoryBySlug } from '../data/categories';
import { fetchCategoryProjects } from '../data/projects';

/** /category/:slug — the void behind a container: its wireframe with that category's projects orbiting it. */
const Category = () => {
  const { slug } = useParams();
  const category = categoryBySlug(slug);
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [hovered, setHovered] = useState(null);
  // Opened from a link instead of the container: keep the preloader up until the wireframe is ready.
  const ready = usePageHold();

  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    fetchCategoryProjects(category).then((list) => {
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!category) return <Navigate to="/" replace />;

  return (
    <div className="category-page">
      <CategoryVoid
        category={category}
        projects={projects}
        onReady={ready}
        onHover={setHovered}
        onOpen={(project) => navigate(`/projects/${project.id}`, { state: { from: slug } })}
      />

      <button
        type="button"
        className="category-back"
        onClick={() => navigate('/', { state: { scrollTo: 'level-03' } })}
      >
        ← Back to the bay
      </button>

      <div className="category-info">
        <p className="category-kicker">Category // {String(projects.length).padStart(2, '0')} projects</p>
        <h1 className="category-title">{category.label}</h1>
        <p className={`category-hint${hovered ? ' is-project' : ''}`}>
          {hovered ? `Open ${hovered.title}` : 'Drag to look around · click a project to open it'}
        </p>
      </div>
    </div>
  );
};

export default Category;
