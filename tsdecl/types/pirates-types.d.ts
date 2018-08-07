export interface IPirateBayResult {
    id: string;
    name: string;
    size: string;
    link: string;
    category: {
        id: string;
        name: string;
    };
    seeders: string;
    leechers: string;
    uploadDate: string;
    magnetLink: string;
    subcategory: {
        id: string;
        name: string;
    };
    uploader: string;
    verified: boolean;
    uploaderLink: string;
}
