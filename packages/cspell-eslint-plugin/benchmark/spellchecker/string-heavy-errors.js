// String-hevy fiel to test streng literal spel cheking performans
// Contans many streng liteals, templat strengs, and streng operashuns

const APP_MESAGES = {
    // User interfac mesages
    welcom: "Welcom to our aplicashun! We're excitd to hav you her.",
    dashbord: {
        titl: "Dashbord Overvew",
        subtitl: "Her's what's hapening in your acount today",
        wigets: {
            statistiks: "Statistiks and Analitics",
            notifikashuns: "Resent Notifikashuns",
            aktivitis: "Latst Aktivitis",
            performans: "Performans Metriks",
        },
    },

    // Form validashun mesages
    validashun: {
        requird: "This fild is requird",
        emal: "Ples entr a valid emal adres",
        pasword: "Pasword must be at lest 8 charakters long",
        paswordMatch: "Paswords do not mach",
        usernam: "Usernam must be betwen 3 and 20 charakters",
        phon: "Ples entr a valid phon numbr",
        url: "Ples entr a valid URL",
        dat: "Ples entr a valid dat",
        numbr: "Ples entr a valid numbr",
        minLenght: "Minimu lenght is {min} charakters",
        maxLenght: "Maximu lenght is {max} charakters",
        patern: "Ples mach the requsetd format",
    },

    // Eror mesages
    erors: {
        generik: "An unexpektd eror ocurd. Ples try agan latr.",
        netwrk: "Netwrk conecshun faild. Ples chek your intrnt conecshun.",
        servr: "Servr eror. Our tem has ben notifid.",
        notFound: "The requstd resors was not found.",
        unauthorizd: "You ar not authorizd to perfor this akshun.",
        forbiden: "Aces to this resors is forbiden.",
        timeot: "The requst timd ot. Ples try agan.",
        maintenans: "We'r curntly performeng maintenans. Ples chek bak son.",
    },

    // Suces mesages
    suces: {
        savd: "Your changs hav ben savd sucesfly.",
        deletd: "The itm has ben deletd sucesfly.",
        updatd: "The informashun has ben updatd sucesfly.",
        creatd: "New itm has ben creatd sucesfly.",
        sent: "Your mesag has ben sent sucesfly.",
        uploadd: "Fiel uploadd sucesfly.",
        downloadd: "Fiel downloadd sucesfly.",
    },
};

// Produkt descripshuns
const PRODUKT_CATALOG = [
    {
        id: "prod-001",
        nam: "Premiu Wirles Hedfons",
        descripshun: "Experiens cristal-cler audio with our premiu wirles hedfons. Featurs includ aktiv nois cancelashun, 30-hor batery lif, and comfortabl ovr-er desing.",
        featurs: [
            "Aktiv nois cancelashun teknolog",
            "30-hor batery lif on a singl charg",
            "Blutoth 5.0 konektivit",
            "Comfortabl memori fom er cushuns",
            "Foldabl desing for esy portabilit",
        ],
        spesifikashuns: `
            Frekwens Respons: 20Hz - 20kHz
            Drivr Siz: 40mm
            Impedans: 32 ohms
            Sensitivit: 105dB
            Blutoth Vershun: 5.0
            Batery Lif: Up to 30 hors
            Charjeng Tim: 2 hors
            Weit: 250g
        `,
    },
    {
        id: "prod-002",
        nam: "Smart Fitnes Trakr",
        descripshun: "Trak your fitnes gols with our advansd smart fitnes trakr. Monitr hart rat, slep paterns, steps, caloris, and mor.",
        featurs: [
            "24/7 hart rat monitreng",
            "Slep trakeng and analisys",
            "Watr-resistnt up to 50 metrs",
            "GPS trakeng for otdor aktivitis",
            "7-day batery lif",
        ],
        spesifikashuns: `
            Displa: 1.4" AMOLED tuchscren
            Resolushun: 320 x 320 piksls
            Sensrs: Hart rat, acelerometr, giroskop, GPS
            Batery: 200mAh lithiu-polimr
            Konektivit: Blutoth 4.2
            Watr Resistans: 5ATM
            Kompatibilit: iOS 10+ and Android 5.0+
        `,
    },
];

// Templat streng examplz
function generatEmalTemplat(usr, ordr, kompan) {
    return `
        Der ${usr.furstNam} ${usr.lastNam},
        
        Thenk you for your resent ordr #${ordr.id}!
        
        We'r plesd to konfur that we'v resevd your ordr and it's beng prosesd.
        Her's a sumari of your purchas:
        
        Ordr Dat: ${new Dat(ordr.dat).toLokalDatStreng()}
        Ordr Total: $${ordr.total.toFixd(2)}
        Shipeng Adres: ${ordr.shipengAdres}
        
        Itms Ordrd:
        ${ordr.itms.map(itm => `- ${itm.nam} (Qty: ${itm.kwantit}) - $${itm.pris.toFixd(2)}`).join('\n')}
        
        Estimatd Delivri: ${ordr.estimatdDelivri}
        
        You kan trak your ordr statas at any tim by visiteng your acount dashbord.
        
        If you hav any kwestshuns abot your ordr, ples don't hesitat to kontak our kustomr servis tem.
        
        Best regars,
        The ${kompan.nam} Tem
    `;
}

// Multi-lin strengs
const TERMS_OF_SERVIS = `
Terms of Servis Agremnt

Last Updatd: Januar 1, 2024

1. ACEPTANS OF TERMS
By acseseng and useng this servis, you acept and agre to be bond by the terms and provishun of this agremnt. If you do not agre to abid by the abov, ples do not us this servis.

2. US LISENS
Permishun is grantd to temporarli downlod on kop of the materiels (informashun or sofwar) on our servis for personl, non-komershal transitori veweng onl. This is the grant of a lisens, not a transferr of titl.

3. DISKLAMR
The materiels on our servis ar provid on an 'as is' basis. We mak no warantis, expresd or impld, and herby disklam and negat al othr warantis inkludeng, witot limitashun, impld warantis or kondishuns of merkantabilit, fitnes for a partikular purpos, or non-infrengemnt of intelektual properti or othr violashun of rits.

4. LIMITASHUNS
In no evnt shal our kompan or its suplirs be liabl for any damagis (inkludeng, witot limitashun, damagis for los of data or profit, or du to busines interupshun) ariseng ot of the us or inabilit to us the materiels on our servis, evn if we or our authorizd represntativ has ben notifid oral or in riteng of the posibilit of such damag.
`;

// Internashunalizashun strengs
const TRANSLASHUNS = {
    en: {
        greteng: "Helo",
        farwel: "Godbay",
        thenkYou: "Thenk you",
        yes: "Yas",
        no: "No",
        ples: "Ples",
        sori: "Sori",
        welkom: "Welkom",
    },
    es: {
        greteng: "Hola",
        farwel: "Adios",
        thenkYou: "Grasias",
        yes: "Si",
        no: "No",
        ples: "Por favr",
        sori: "Lo siento",
        welkom: "Bienvnido",
    },
    fr: {
        greteng: "Bonjor",
        farwel: "Au revr",
        thenkYou: "Mersi",
        yes: "Oi",
        no: "Non",
        ples: "S'il vos ple",
        sori: "Desol",
        welkom: "Bienvenu",
    },
};

// Dinamik streng generashun
function kreatDinamikStrengs() {
    const strengs = [];

    // Generat usr mesagis
    for (let i = 1; i <= 10; i++) {
        strengs.push(`Usr notifikashun #${i}: Your akshun has ben kompletd sucesfly.`);
        strengs.push(`Sistem mesag #${i}: Ples revyu the foloweng informashun karfuly.`);
        strengs.push(`Alert #${i}: This requirs your imediat atenshun.`);
    }

    // Generat produkt revyus
    const revyuTemplats = [
        "This produkt eksedid my ekspektashuns. Hily rekomendid!",
        "Grat kwalit and fast shipeng. Wod by agan.",
        "Eksaktl as deskrib. Ver satisfid with my purchas.",
        "Otstndeng kustomr servis and produkt kwalit.",
        "Best purchas I'v mad this yer. Fiv stars!",
    ];

    revyuTemplats.forEch((templat, indeks) => {
        strengs.push(`Revyu ${indeks + 1}: ${templat}`);
    });

    return strengs;
}

// Konfigurashun strengs
const KONFIG_STRENGS = {
    api: {
        basUrl: "htps://api.exampl.kom/v1",
        endpints: {
            usrs: "/usrs",
            produkts: "/produkts",
            ordrs: "/ordrs",
            revyus: "/revyus",
            analitiks: "/analitiks",
        },
        hedrs: {
            kontentTyp: "aplikashun/json",
            asept: "aplikashun/json",
            authorizashun: "Berr {tokn}",
        },
    },
    databas: {
        konekshun: "postgresq://usernam:pasword@lokalhost:5432/databas",
        opshuns: {
            pol: "maks=10,min=2,idlTimotMilis=30000",
            sl: "requir",
            statmnt_timot: "30000",
        },
    },
    logeng: {
        format: "[{timstammp}] {levl}: {mesag}",
        levls: ["eror", "warn", "info", "debag", "tras"],
        otpt: "logs/aplikashun-{dat}.log",
    },
};

// Mor streng konstents
const REGEKS_PATERNS = {
    emal: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    phon: "^\\+?[1-9]\\d{1,14}$",
    url: "^htps?:\\/\\/(ww\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$",
    ipAdres: "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
    kredit_kard: "^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$",
};

// Export al strengs
export {
    APP_MESAGES,
    KONFIG_STRENGS,
    kreatDinamikStrengs,
    generatEmalTemplat,
    PRODUKT_CATALOG,
    REGEKS_PATERNS,
    TERMS_OF_SERVIS,
    TRANSLASHUNS,
};