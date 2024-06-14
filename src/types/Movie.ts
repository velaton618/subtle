export class Movie {
  id: string;
  title: string | null;
  links: string[];
  year: number;

  constructor(id: string, title: string | null, links: string[], year: number) {
    this.id = id;
    this.title = title;
    this.links = links;
    this.year = year;
  }
}
