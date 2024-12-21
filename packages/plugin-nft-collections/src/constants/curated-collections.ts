import { z } from "zod";

export const CollectionCategory = z.enum([
    "Gen Art",
    "Photography",
    "AI Inspired",
    "Memetics",
    "Iconic Gems",
]);

export type CollectionCategory = z.infer<typeof CollectionCategory>;

export const CuratedCollectionSchema = z.object({
    address: z.string(),
    name: z.string(),
    category: CollectionCategory,
    creator: z.string().optional(),
    tokenIdRange: z
        .object({
            start: z.string().optional(),
            end: z.string().optional(),
        })
        .optional(),
});

export type CuratedCollection = z.infer<typeof CuratedCollectionSchema>;

/**
 * Curated list of NFT collections featured on ikigailabs.xyz
 */
export const CURATED_COLLECTIONS: CuratedCollection[] = [
    // Gen Art Collections
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Fidenza",
        category: "Gen Art",
        creator: "Tyler Hobbs",
        tokenIdRange: {
            start: "78000000",
            end: "78999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Ringers",
        category: "Gen Art",
        creator: "Dmitri Cherniak",
        tokenIdRange: {
            start: "13000000",
            end: "13999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Pigments",
        category: "Gen Art",
        creator: "Darien Brito",
        tokenIdRange: {
            start: "129000000",
            end: "129999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Human Unreadable",
        category: "Gen Art",
        creator: "Operator",
        tokenIdRange: {
            start: "455000000",
            end: "455999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Skulptuur",
        category: "Gen Art",
        creator: "Piter Pasma",
        tokenIdRange: {
            start: "173000000",
            end: "173999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Scribbled Boundaries",
        category: "Gen Art",
        creator: "William Tan",
        tokenIdRange: {
            start: "131000000",
            end: "131999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "The Harvest",
        category: "Gen Art",
        creator: "Per Kristian Stoveland",
        tokenIdRange: {
            start: "407000000",
            end: "407999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Fragments of an Infinite Field",
        category: "Gen Art",
        creator: "Monica Rizzolli",
        tokenIdRange: {
            start: "159000000",
            end: "159999999",
        },
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "FOLIO",
        category: "Gen Art",
        creator: "Matt DesLauriers",
        tokenIdRange: {
            start: "8000000",
            end: "8999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Meridian",
        category: "Gen Art",
        creator: "Matt DesLauriers",
        tokenIdRange: {
            start: "163000000",
            end: "163999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Archetype",
        category: "Gen Art",
        creator: "Kjetil Golid",
        tokenIdRange: {
            start: "23000000",
            end: "23999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Gazers",
        category: "Gen Art",
        creator: "Matt Kane",
        tokenIdRange: {
            start: "215000000",
            end: "215999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Subscapes",
        category: "Gen Art",
        creator: "Matt DesLauriers",
        tokenIdRange: {
            start: "53000000",
            end: "53999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Anticyclone",
        category: "Gen Art",
        creator: "William Mapan",
        tokenIdRange: {
            start: "304000000",
            end: "304999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Memories of Qilin",
        category: "Gen Art",
        creator: "Emily Xie",
        tokenIdRange: {
            start: "282000000",
            end: "282999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Elevated Deconstructions",
        category: "Gen Art",
        creator: "luxpris",
        tokenIdRange: {
            start: "7000000",
            end: "7999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Screens",
        category: "Gen Art",
        creator: "Thomas Lin Pedersen",
        tokenIdRange: {
            start: "255000000",
            end: "255999999",
        },
    },
    {
        address: "0x059edd72cd353df5106d2b9cc5ab83a52287ac3a",
        name: "Genesis",
        category: "Gen Art",
        creator: "DCA",
        tokenIdRange: {
            start: "1000000",
            end: "1999999",
        },
    },
    {
        address: "0x8cdbd7010bd197848e95c1fd7f6e870aac9b0d3c",
        name: "///",
        category: "Gen Art",
        creator: "Snowfro",
        tokenIdRange: {
            start: "2000000",
            end: "2999999",
        },
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "100 Untitled Spaces",
        category: "Gen Art",
        creator: "Snowfro",
        tokenIdRange: {
            start: "28000000",
            end: "28999999",
        },
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "Inflection",
        category: "Gen Art",
        creator: "Jeff Davis",
        tokenIdRange: {
            start: "3000000",
            end: "3999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Rapture",
        category: "Gen Art",
        creator: "Thomas Lin Pedersen",
        tokenIdRange: {
            start: "141000000",
            end: "141999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Blind Spots",
        category: "Gen Art",
        creator: "Shaderism",
        tokenIdRange: {
            start: "484000000",
            end: "484999999",
        },
    },
    {
        address: "0xc73b17179bf0c59cd5860bb25247d1d1092c1088",
        name: "QQL Mint Pass",
        category: "Gen Art",
        creator: "Tyler Hobbs & Dandelion Wist",
    },
    {
        address: "0x495f947276749ce646f68ac8c248420045cb7b5e",
        name: "888",
        category: "Gen Art",
        creator: "Kevin Abosch",
        tokenIdRange: {
            start: "opensea-888-by-kevin-abosch",
            end: "opensea-888-by-kevin-abosch",
        },
    },
    {
        address: "0x0e42ffbac75bcc30cd0015f8aaa608539ba35fbb",
        name: "Mind the Gap",
        category: "Gen Art",
        creator: "MountVitruvius",
    },
    {
        address: "0x7d2d93eed47e55c873b9580b4e6ebd5bc045d1b6",
        name: "Mercedes",
        category: "Gen Art",
    },
    {
        address: "0x4e1f41613c9084fdb9e34e11fae9412427480e56",
        name: "Terraforms",
        category: "Gen Art",
        creator: "Mathcastles",
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Hōrō",
        category: "Gen Art",
        creator: "makio135",
    },
    {
        address: "0x2b0bfa93beb22f44e7c1be88efd80396f8d9f1d4",
        name: "STATE OF THE ART",
        category: "Gen Art",
        creator: "ThankYouX",
    },
    {
        address: "0xA4F6105B612f913e468F6B27FCbb48c3569ACbE7",
        name: "TECTONICS",
        category: "Gen Art",
        creator: "mpkoz",
    },
    {
        address: "0x845dd2a7ee2a92a0518ab2135365ed63fdba0c88",
        name: "QQL",
        category: "Gen Art",
        creator: "Tyler Hobbs & Dandelion Wist",
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Passin",
        category: "Gen Art",
        tokenIdRange: {
            start: "314000000",
            end: "314999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Yazid",
        category: "Gen Art",
        tokenIdRange: {
            start: "281000000",
            end: "281999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Radix 2",
        category: "Gen Art",
        tokenIdRange: {
            start: "139000000",
            end: "139999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Radix 1",
        category: "Gen Art",
        tokenIdRange: {
            start: "104000000",
            end: "104999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Catblocks",
        category: "Gen Art",
        tokenIdRange: {
            start: "73000000",
            end: "73999999",
        },
    },
    {
        address: "0x4d928ab507bf633dd8e68024a1fb4c99316bbdf3",
        name: "Love Tennis",
        category: "Gen Art",
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Renders Game",
        category: "Gen Art",
        creator: "MountVitruvius",
        tokenIdRange: {
            start: "415000000",
            end: "415999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Running Moon",
        category: "Gen Art",
        creator: "Licia He",
        tokenIdRange: {
            start: "334000000",
            end: "334999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Neural Sediments",
        category: "Gen Art",
        creator: "Eko33",
        tokenIdRange: {
            start: "418000000",
            end: "418999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Fontana",
        category: "Gen Art",
        creator: "Harvey Rayner",
        tokenIdRange: {
            start: "367000000",
            end: "367999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Algobots",
        category: "Gen Art",
        creator: "Stina Jones",
        tokenIdRange: {
            start: "40000000",
            end: "40999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Apparitions",
        category: "Gen Art",
        creator: "Aaron Penne",
        tokenIdRange: {
            start: "28000000",
            end: "28999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "[Dis]entanglement",
        category: "Gen Art",
        creator: "onlygenerated",
        tokenIdRange: {
            start: "97000000",
            end: "97999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Semblance",
        category: "Gen Art",
        creator: "rahul iyer",
        tokenIdRange: {
            start: "447000000",
            end: "447999999",
        },
    },
    {
        address: "0xCe3aB0D9D5e36a12235def6CaB84C355D51703aB",
        name: "Interference",
        category: "Gen Art",
        creator: "Phaust",
    },
    {
        address: "0x495f947276749ce646f68ac8c248420045cb7b5e",
        name: "888",
        category: "Gen Art",
        creator: "Kevin Abosch",
        tokenIdRange: {
            start: "opensea-888-by-kevin-abosch",
            end: "opensea-888-by-kevin-abosch",
        },
    },
    {
        address: "0x2DB452c9A7b14f927F51589a54B4D56dD4B31977",
        name: "Web",
        category: "Gen Art",
        creator: "Jan Robert Leegte / Superposition",
    },
    {
        address: "0x7F72528229F85C99D8843C0317eF91F4A2793Edf",
        name: "1111",
        category: "Gen Art",
        creator: "Kevin Abosch",
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Geometry Runners",
        category: "Gen Art",
        creator: "Rich Lord",
        tokenIdRange: {
            start: "138000000",
            end: "138999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Ecumenopolis",
        category: "Gen Art",
        creator: "Joshua Bagley",
        tokenIdRange: {
            start: "119000000",
            end: "119999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Edifice",
        category: "Gen Art",
        creator: "Ben Kovach",
        tokenIdRange: {
            start: "204000000",
            end: "204999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Singularity",
        category: "Gen Art",
        creator: "Hideki Tsukamoto",
        tokenIdRange: {
            start: "8000000",
            end: "8999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Rinascita",
        category: "Gen Art",
        creator: "Stefano Contiero",
        tokenIdRange: {
            start: "121000000",
            end: "121999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Alien Insects",
        category: "Gen Art",
        creator: "Shvembldr",
        tokenIdRange: {
            start: "137000000",
            end: "137999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "720 Minutes",
        category: "Gen Art",
        creator: "Alexis André",
        tokenIdRange: {
            start: "27000000",
            end: "27999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "CENTURY",
        category: "Gen Art",
        creator: "Casey REAS",
        tokenIdRange: {
            start: "100000000",
            end: "100999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "LeWitt Generator Generator",
        category: "Gen Art",
        creator: "Mitchell F. Chan",
        tokenIdRange: {
            start: "118000000",
            end: "118999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Endless Nameless",
        category: "Gen Art",
        creator: "Rafaël Rozendaal",
        tokenIdRange: {
            start: "120000000",
            end: "120999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Obicera",
        category: "Gen Art",
        creator: "Alexis André",
        tokenIdRange: {
            start: "130000000",
            end: "130999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Bubble Blobby",
        category: "Gen Art",
        creator: "Jason Ting",
        tokenIdRange: {
            start: "62000000",
            end: "62999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Divisions",
        category: "Gen Art",
        creator: "Michael Connolly",
        tokenIdRange: {
            start: "108000000",
            end: "108999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Phototaxis",
        category: "Gen Art",
        creator: "Casey REAS",
        tokenIdRange: {
            start: "164000000",
            end: "164999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "ORI",
        category: "Gen Art",
        creator: "James Merrill",
        tokenIdRange: {
            start: "379000000",
            end: "379999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Trichro-matic",
        category: "Gen Art",
        creator: "MountVitruvius",
        tokenIdRange: {
            start: "482000000",
            end: "482999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Return",
        category: "Gen Art",
        creator: "Aaron Penne",
        tokenIdRange: {
            start: "77000000",
            end: "77999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Pre-Process",
        category: "Gen Art",
        creator: "Casey REAS",
        tokenIdRange: {
            start: "383000000",
            end: "383999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Cargo",
        category: "Gen Art",
        creator: "Kim Asendorf",
        tokenIdRange: {
            start: "426000000",
            end: "426999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Ieva",
        category: "Gen Art",
        creator: "Shvembldr",
        tokenIdRange: {
            start: "339000000",
            end: "339999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Color Study",
        category: "Gen Art",
        creator: "Jeff Davis",
        tokenIdRange: {
            start: "16000000",
            end: "16999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "R3sonance",
        category: "Gen Art",
        creator: "ge1doot",
        tokenIdRange: {
            start: "19000000",
            end: "19999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Primitives",
        category: "Gen Art",
        creator: "Aranda\\Lasch",
        tokenIdRange: {
            start: "368000000",
            end: "368999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "RASTER",
        category: "Gen Art",
        creator: "itsgalo",
        tokenIdRange: {
            start: "341000000",
            end: "341999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Messengers",
        category: "Gen Art",
        creator: "Alexis André",
        tokenIdRange: {
            start: "68000000",
            end: "68999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Squares",
        category: "Gen Art",
        creator: "Martin Grasser",
        tokenIdRange: {
            start: "330000000",
            end: "330999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "The Liths of Sisyphus",
        category: "Gen Art",
        creator: "nonfigurativ",
        tokenIdRange: {
            start: "124000000",
            end: "124999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Stroming",
        category: "Gen Art",
        creator: "Bart Simons",
        tokenIdRange: {
            start: "86000000",
            end: "86999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Paths",
        category: "Gen Art",
        creator: "Darien Brito",
        tokenIdRange: {
            start: "217000000",
            end: "217999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Enchiridion",
        category: "Gen Art",
        creator: "Generative Artworks",
        tokenIdRange: {
            start: "101000000",
            end: "101999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Getijde",
        category: "Gen Art",
        creator: "Bart Simons",
        tokenIdRange: {
            start: "226000000",
            end: "226999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Flux",
        category: "Gen Art",
        creator: "Owen Moore",
        tokenIdRange: {
            start: "296000000",
            end: "296999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Good, Computer",
        category: "Gen Art",
        creator: "Dean Blacc",
        tokenIdRange: {
            start: "396000000",
            end: "396999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Non Either",
        category: "Gen Art",
        creator: "Rafaël Rozendaal",
        tokenIdRange: {
            start: "260000000",
            end: "260999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Gumbo",
        category: "Gen Art",
        creator: "Mathias Isaksen",
        tokenIdRange: {
            start: "462000000",
            end: "462999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "70s Pop Series One",
        category: "Gen Art",
        creator: "Daniel Catt",
        tokenIdRange: {
            start: "46000000",
            end: "46999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Vahria",
        category: "Gen Art",
        creator: "Darien Brito",
        tokenIdRange: {
            start: "340000000",
            end: "340999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Pointila",
        category: "Gen Art",
        creator: "Phaust",
        tokenIdRange: {
            start: "353000000",
            end: "353999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Intersections",
        category: "Gen Art",
        creator: "Rafaël Rozendaal",
        tokenIdRange: {
            start: "373000000",
            end: "373999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "This Is Not A Rock",
        category: "Gen Art",
        creator: "Nicole Vella",
        tokenIdRange: {
            start: "471000000",
            end: "471999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Immaterial",
        category: "Gen Art",
        creator: "Bjørn Staal",
        tokenIdRange: {
            start: "481000000",
            end: "481999999",
        },
    },
    {
        address: "0x7d2d93eed47e55c873b9580b4e6ebd5bc045d1b6",
        name: "Maschine",
        category: "Gen Art",
    },
    {
        address: "0xcbc8a5472bba032125c1a7d11427aa3b5035207b",
        name: "Blocks",
        category: "Gen Art",
        creator: "Harto",
    },
    {
        address: "0x145789247973c5d612bf121e9e4eef84b63eb707",
        name: "923 EMPTY ROOMS",
        category: "Gen Art",
        creator: "Casey REAS",
        tokenIdRange: {
            start: "1000000",
            end: "1999999",
        },
    },
    {
        address: "0x71b1956bc6640a70893e49f5816724425891f159",
        name: "Fleeting Thoughts",
        category: "Gen Art",
        creator: "Nadieh Bremer",
    },
    {
        address: "0xc332fa232ab53628d0e9acbb806c5ee5a82b3467",
        name: "Hypnagogic",
        category: "Gen Art",
        creator: "rudxane",
    },
    {
        address: "0x32d4be5ee74376e08038d652d4dc26e62c67f436",
        name: "Elefante",
        category: "Gen Art",
        creator: "Michael Connolly",
        tokenIdRange: {
            start: "4000000",
            end: "4999999",
        },
    },
    {
        address: "0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270",
        name: "Brushpops",
        category: "Gen Art",
        creator: "Matty Mariansky",
        tokenIdRange: {
            start: "135000000",
            end: "135999999",
        },
    },
    {
        address: "0xeb7088423d7f8c1448ef074fc372bc67efa4de44",
        name: "Toys",
        category: "Gen Art",
        creator: "0xTechno",
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Fleur",
        category: "Gen Art",
        creator: "AnaPet",
        tokenIdRange: {
            start: "378000000",
            end: "378999999",
        },
    },
    {
        address: "0x29e891f4f2ae6a516026e3bcf0353d798e1de90",
        name: "Cathartic Prism",
        category: "Gen Art",
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "100 Sunsets",
        category: "Gen Art",
        creator: "Zach Lieberman",
        tokenIdRange: {
            start: "29000000",
            end: "29999999",
        },
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "Sparkling Goodbye",
        category: "Gen Art",
        creator: "Licia He",
        tokenIdRange: {
            start: "47000000",
            end: "47999999",
        },
    },
    {
        address: "0xe034bb2b1b9471e11cf1a0a9199a156fb227aa5d",
        name: "Themes and Variations",
        category: "Gen Art",
        creator: "Vera Molnár",
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "Formation",
        category: "Gen Art",
        creator: "Jeff Davis",
        tokenIdRange: {
            start: "11000000",
            end: "11999999",
        },
    },
    {
        address: "0x229b1a62210c2329fe7a0ee67f517ae611789b35",
        name: "CIPHERS",
        category: "Gen Art",
        creator: "Per Kristian Stoveland",
    },
    {
        address: "0xaa39b261b8d4fdaa8a1ed436cc14a723c0480ee9",
        name: "Glitch",
        category: "Gen Art",
    },
    {
        address: "0x95864937cc8c90878c3254cf418632f8154d3b7d",
        name: "Quadrature",
        category: "Gen Art",
        creator: "Darien Brito",
    },
    {
        address: "0x9bf53d8c65f03d895dacaa776cc960e462ecb599",
        name: "Primera",
        category: "Gen Art",
        creator: "Mitchell and Yun",
    },
    {
        address: "0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676",
        name: "1935",
        category: "Gen Art",
        creator: "William Mapan",
        tokenIdRange: {
            start: "25000000",
            end: "25999999",
        },
    },
    {
        address: "0x99a9b7c1116f9ceeb1652de04d5969cce509b069",
        name: "Memories of Digital Data",
        category: "Gen Art",
        creator: "Kazuhiro Tanimoto",
        tokenIdRange: {
            start: "428000000",
            end: "428999999",
        },
    },
    {
        address: "0x2c7f335460fb9df460ff7ad6cc64cb7dd4064862",
        name: "BITFRAMES",
        category: "Gen Art",
    },

    // Photography Collections
    {
        address: "0x509a050f573be0d5e01a73c3726e17161729558b",
        name: "Where My Vans Go",
        category: "Photography",
    },
    // ... rest of Photography collections ...

    // AI Inspired Collections
    // ... AI Inspired collections ...

    // Memetics Collections
    // ... Memetics collections ...

    // Iconic Gems Collections
    // ... Iconic Gems collections ...
];

// Export helper functions
export {
    isCuratedCollection,
    getCuratedCollection,
    getCuratedAddresses,
    getFeaturedAddresses,
    getVerifiedAddresses,
} from "./collections";

// Helper functions
export function getCollectionsByCategory(
    category: CollectionCategory
): CuratedCollection[] {
    return CURATED_COLLECTIONS.filter(
        (collection) => collection.category === category
    );
}

export function getCategoryCount(category: CollectionCategory): number {
    return getCollectionsByCategory(category).length;
}

export function getAllCategories(): CollectionCategory[] {
    return [
        ...new Set(
            CURATED_COLLECTIONS.map((collection) => collection.category)
        ),
    ];
}

export function getCollectionsByCreator(creator: string): CuratedCollection[] {
    return CURATED_COLLECTIONS.filter(
        (collection) =>
            collection.creator?.toLowerCase() === creator.toLowerCase()
    );
}

// Create a map for quick lookups
export const COLLECTIONS_BY_ADDRESS = new Map<string, CuratedCollection>(
    CURATED_COLLECTIONS.map((collection) => [
        collection.address.toLowerCase(),
        collection,
    ])
);

// URL and viewing helpers
export const IKIGAI_BASE_URL = "https://ikigailabs.xyz/ethereum";

export interface CollectionViewOptions {
    sortBy?:
        | "floor_asc"
        | "floor_desc"
        | "volume_asc"
        | "volume_desc"
        | "created_asc"
        | "created_desc";
    filterBy?: "listed" | "all";
}

export function getCollectionUrl(address: string): string {
    return `${IKIGAI_BASE_URL}/${address}`;
}

export function getCollectionViewUrl(
    address: string,
    options?: CollectionViewOptions
): string {
    const baseUrl = getCollectionUrl(address);
    if (!options) return baseUrl;

    const params = new URLSearchParams();
    if (options.sortBy) params.append("sort", options.sortBy);
    if (options.filterBy) params.append("filter", options.filterBy);

    return `${baseUrl}?${params.toString()}`;
}

// Helper to get URLs for all collections in a category
export function getCategoryUrls(category: CollectionCategory): string[] {
    return getCollectionsByCategory(category).map((collection) =>
        getCollectionUrl(collection.address)
    );
}

// Helper to get URLs for collections by a specific creator
export function getCreatorCollectionUrls(creator: string): string[] {
    return getCollectionsByCreator(creator).map((collection) =>
        getCollectionUrl(collection.address)
    );
}

// Helper to get a formatted collection view with URL
export function getCollectionView(address: string): {
    collection: CuratedCollection | undefined;
    url: string;
} {
    const collection = COLLECTIONS_BY_ADDRESS.get(address.toLowerCase());
    return {
        collection,
        url: getCollectionUrl(address),
    };
}

// Helper to get multiple collection views
export function getCollectionViews(addresses: string[]): {
    collection: CuratedCollection | undefined;
    url: string;
}[] {
    return addresses.map((address) => getCollectionView(address));
}

// Helper to get all collections in a category with their URLs
export function getCategoryCollectionViews(category: CollectionCategory): {
    collection: CuratedCollection;
    url: string;
}[] {
    return getCollectionsByCategory(category).map((collection) => ({
        collection,
        url: getCollectionUrl(collection.address),
    }));
}

// Helper to format collection data for display
export function formatCollectionData(collection: CuratedCollection): string {
    const url = getCollectionUrl(collection.address);
    return `
Collection: ${collection.name}
Category: ${collection.category}
${collection.creator ? `Creator: ${collection.creator}` : ""}
View on IkigaiLabs: ${url}
${collection.tokenIdRange ? `Token Range: ${collection.tokenIdRange.start || "0"} - ${collection.tokenIdRange.end || "unlimited"}` : ""}
`;
}

// Helper to get a shareable collection link with optional sort/filter
export function getShareableCollectionLink(
    address: string,
    options?: CollectionViewOptions
): string {
    const url = getCollectionViewUrl(address, options);
    return `View this NFT collection on IkigaiLabs: ${url}`;
}
