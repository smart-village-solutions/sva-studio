import type {
  ProjectContentItem,
  ProjectFormInput,
  ProjectImage,
} from './projects.api-types.js';
import { projectFormSchema, type ProjectFormValues } from './projects.validation.js';

export const normalizeProjectImages = (
  images: readonly Omit<ProjectImage, 'position'>[] | readonly ProjectImage[]
): readonly ProjectImage[] =>
  images.map((image, position) => {
    const { url, altText, caption, credits, ...additional } = image;
    return {
      ...additional,
      url: url.trim(),
      altText: altText.trim(),
      ...(caption?.trim() ? { caption: caption.trim() } : {}),
      ...(credits?.trim() ? { credits: credits.trim() } : {}),
      position,
    };
  });

export const normalizeProjectInput = (input: ProjectFormValues): ProjectFormInput => {
  const parsed = projectFormSchema.parse(input);
  return {
    language: parsed.language.trim(),
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    fullText: parsed.fullText.trim(),
    images: normalizeProjectImages(parsed.images),
    status: parsed.status,
    author: {
      type: parsed.author.type,
      id: parsed.author.id.trim(),
      displayName: parsed.author.displayName.trim(),
    },
  };
};

export const projectToFormValues = (project: ProjectContentItem): ProjectFormValues => ({
  language: project.language,
  title: project.title,
  description: project.description,
  fullText: project.fullText,
  images: project.images.map((image) => ({ ...image })),
  status: project.status,
  author: { ...project.author },
});

export const createDefaultProjectFormValues = (): ProjectFormValues => ({
  language: '',
  title: '',
  description: '',
  fullText: '',
  images: [],
  status: 'draft',
  author: { type: 'organization', id: '', displayName: '' },
});
