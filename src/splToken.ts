import {AccountInfo, Connection, PublicKey} from "@solana/web3.js";
import {TOKEN_PROGRAM_ID} from "@solana/spl-governance";
import {Account as TokenAccount, ACCOUNT_SIZE, AccountLayout, AccountState} from "@solana/spl-token";

export async function getTokenAccountsByMint(connection:Connection,mint:PublicKey):Promise<TokenAccount[]>{
    const results = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
            {
                dataSize: 165,
            },
            {
                memcmp: {
                    offset: 0,
                    bytes: mint.toBase58(),
                },
            },
        ],
    })

    return results.map(({pubkey,account}) => {
        const decodedAccount = unpackAccount(account,pubkey)
        return decodedAccount
    })
}

export function unpackAccount(
    info: AccountInfo<Buffer>, address: PublicKey
): TokenAccount {

    const rawAccount = AccountLayout.decode(info.data.slice(0, ACCOUNT_SIZE));

    return {
        address,
        mint: rawAccount.mint,
        owner: rawAccount.owner,
        amount: rawAccount.amount,
        delegate: rawAccount.delegateOption ? rawAccount.delegate : null,
        delegatedAmount: rawAccount.delegatedAmount,
        isInitialized: rawAccount.state !== AccountState.Uninitialized,
        isFrozen: rawAccount.state === AccountState.Frozen,
        isNative: !!rawAccount.isNativeOption,
        rentExemptReserve: rawAccount.isNativeOption ? rawAccount.isNative : null,
        closeAuthority: rawAccount.closeAuthorityOption ? rawAccount.closeAuthority : null,
    };
}