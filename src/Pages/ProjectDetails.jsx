import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import './ProjectDetails.css';
import { usePageHold } from '../Components/Layout/PageLoader';
import { fetchProject } from '../data/projects';

/** /projects/:id — placeholder details page, to be designed. Shows what Supabase has for the project. */
const ProjectDetails = () => {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [project, setProject] = useState(undefined); // undefined = loading, null = not found
  const ready = usePageHold();

  useEffect(() => {
    let cancelled = false;
    fetchProject(id).then((p) => {
      if (cancelled) return;
      setProject(p);
      ready();
    });
    return () => {
      cancelled = true;
    };
  }, [id, ready]);

  const back = () => (state?.from ? navigate(`/category/${state.from}`) : navigate(-1));

  return (
    <div className="project-page">
      <button type="button" className="category-back project-back" onClick={back}>
        ← Back
      </button>

      {project === null && (
        <p className="project-kicker">This project has no details yet (placeholder or not found).</p>
      )}

      {project && (
        <>
          <p className="project-kicker">{project.categoryTitle || 'Project'}</p>
          <h1 className="project-title">{project.title}</h1>

          {project.video ? (
            <video className="project-media" src={project.video} controls playsInline poster={project.thumbnail || undefined} />
          ) : project.thumbnail ? (
            <img className="project-media" src={project.thumbnail} alt={project.title} />
          ) : (
            <div className="project-media project-media--empty">No showcase yet</div>
          )}

          {project.description && <p className="project-desc">{project.description}</p>}

          {project.tools.length > 0 && (
            <ul className="project-tools">
              {project.tools.map((t) => (
                <li key={t.name}>{t.name}</li>
              ))}
            </ul>
          )}

          {project.media.length > 0 && (
            <div className="project-gallery">
              {project.media.map((url) => (
                <img key={url} src={url} alt="" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectDetails;
