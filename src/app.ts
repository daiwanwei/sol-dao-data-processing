import {getAllTokenOwnerRecords, getRealm} from "@solana/spl-governance";
import {clusterApiUrl, Connection, PublicKey} from "@solana/web3.js";
import {GOVERNANCES} from "./mainnet-beta";
// import {TEST_GOVERNANCES} from "./mainnet-beta-test";
import * as fs from "fs";
import {REALM_INFO} from "./realmInfo";
// import {REALM_INFO_TEST} from "./realmInfoTest";

interface Citizen {
    governanceProgram: string,
    realm: string,
    address: string,
    citizenType: string,
    mint: string,
}

async function getCitizenOfRealm(
    connection: Connection,
    governanceProgram: PublicKey,
    realmPubKey: PublicKey,
): Promise<Citizen[]> {
    /*tokenOwnerRecord 是這個國家的身分證
    身分證有分兩種類型一個是community(普通市民擁有),另一種是council(像是立法委員)
    立法委員負責審核proposal,通過後交給普通市民公投
    立法委員會擁有兩個身分證,community和council
    */
    const realm = await getRealm(connection, realmPubKey)
    const mintForCommunity = realm.account.communityMint
    const mintForCouncil = realm.account.config.councilMint
    const records = await getAllTokenOwnerRecords(connection, governanceProgram, realmPubKey)
    let citizens: Citizen[] = []

    for (let record of records) {
        const data = record.account
        const mint = data.governingTokenMint
        // console.log(record)
        // console.log(`realm: ${data.realm.toBase58()}`)
        // console.log(`mint account(可能是community or council): ${mint.toBase58()}`)
        // console.log(`身分證持有人: ${data.governingTokenOwner.toBase58()}`)
        const citizen = {
            governanceProgram: governanceProgram.toBase58(),
            realm: realmPubKey.toBase58(),
            address: data.governingTokenOwner.toBase58(),
            citizenType: getCitizenType(mint, mintForCommunity, mintForCouncil),
            mint: mint.toBase58(),
        }
        citizens.push(citizen)
    }
    return citizens;
}

async function getCitizenOfRealmFromFile(
    connection: Connection,
): Promise<Citizen[]> {
    let citizens:Citizen[]=[]
    for (let info of REALM_INFO){
        const governanceProgram=new PublicKey(info.governanceProgram)
        const realmPubKey=new PublicKey(info.address)
        const mintForCommunity=new PublicKey(info.mintCommunity)
        const mintForCouncil=info.mintCouncil!=="unknown"?
            new PublicKey(info.mintCouncil):undefined;
        const records = await getAllTokenOwnerRecords(connection, governanceProgram, realmPubKey)
        for (let record of records) {
            const data = record.account
            const mint = data.governingTokenMint
            const citizen = {
                governanceProgram: governanceProgram.toBase58(),
                realm: realmPubKey.toBase58(),
                address: data.governingTokenOwner.toBase58(),
                citizenType: getCitizenType(mint,mintForCommunity , mintForCouncil),
                mint: mint.toBase58(),
            }
            citizens.push(citizen)
        }
        sleep(500);
    }
    return citizens;
}

async function generateCitizenToFile(connection: Connection){
    const citizens=await getCitizenOfRealmFromFile(connection)
    const data = JSON.stringify(citizens);
    // console.log(data)
    fs.writeFileSync('./citizen_info.json', data);
}

function getCitizenType(
    mint: PublicKey,
    mintCommunity: PublicKey,
    mintCouncil: PublicKey | undefined,
): CitizenType {
    if (mintCouncil) {
        if (mintCouncil.equals(mint)) {
            console.log(`Council:mint(${mint.toBase58()}),council(${mintCouncil.toBase58()})`)
            return CitizenType.Council
        }
    }
    if (mintCommunity.equals(mint)) {
        console.log(`Community:mint(${mint.toBase58()}),Community(${mintCommunity.toBase58()})`)
        return CitizenType.Community
    }
    const council=mintCouncil?mintCouncil.toBase58():"unknown"
    console.log(`Unknown:mint(${mint.toBase58()}),council(${council}),Community(${mintCommunity.toBase58()})`)
    return CitizenType.Unknown
}

enum CitizenType {
    Council = "council",
    Community = "community",
    Unknown = "unknown",
}

interface RealmInfo {
    name: string,
    governanceProgram: string,
    address: string,
    mintCouncil: string,
    mintCommunity: string,
}

async function getRealmInfo(
    connection: Connection,
    governanceProgram: PublicKey,
    realmPubKey: PublicKey,
): Promise<RealmInfo> {
    const realm = await getRealm(connection, realmPubKey)
    const data = realm.account;
    const info = {
        name: data.name,
        governanceProgram: governanceProgram.toBase58(),
        address: realmPubKey.toBase58(),
        mintCouncil: data.config.councilMint ? data.config.councilMint.toBase58() : "unknown",
        mintCommunity: data.communityMint.toBase58(),
    }
    return info;
}

async function generateRealmFile(connection: Connection) {
    let infos: RealmInfo[] = []
    for (let gov of GOVERNANCES) {
        try {
            const govProgram=new PublicKey(gov.programId)
            const realm=new PublicKey(gov.realmId)
            const info = await getRealmInfo(
                connection,govProgram,realm
            )
            infos.push(info)
        }catch (e){
            console.log(`get realm err:${e}`)
        }

        sleep(100)
    }
    const data = JSON.stringify(infos);
    // console.log(data)
    fs.writeFileSync('./realm_info.json', data);
}

function sleep(delay: number) {
    let start = new Date().getTime();
    while (new Date().getTime() < start + delay) ;
}


async function main() {

    /* use case :orca dao
    {
        "symbol": "ORCA",
        "displayName": "Orca DAO",
        "programId": "J9uWvULFL47gtCPvgR3oN7W357iehn5WF2Vn9MJvcSxz", 這是ocra自己的dao program
        "realmId": "66Du7mXgS2KMQBUk6m9h3TszMjqZqdWhsG3Duuf69VNW",
        "website": "https://www.orca.so/",
        "twitter": "@orca_so",
        "ogImage": "https://learn.orca.so/static/media/logomark.1ef55f8f.svg"
    },
    * */
    const rpcUri="https://ssc-dao.genesysgo.net/"
    const connection = new Connection(rpcUri, "confirmed")

    // await generateRealmFile(connection)
    await generateCitizenToFile(connection)

}

main()
    .then(() => console.log(`execute successfully`))
    .catch((e) => console.log(`execute fail,err:${e}`))
    .finally(() => process.exit(0))