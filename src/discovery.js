import produce from 'immer';

import {
  GAP_LIMIT,
  GAP_ACCOUNT_LIMIT,
  LEGACY,
  NESTED_SEGWIT,
  NATIVE_SEGWIT
} from './constants';

import { networks, getNetworkId, getNetworkCoinType } from './networks';

import {
  getExtPubAddress,
  serializeDerivationPath,
  getDerivationPathAddress
} from './bip44';

import { checkNetwork, checkExtPub } from './check';

import { Transaction } from 'bitcoinjs-lib';

/**
 * Class representing the discovery of {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}/{@link https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki 49}/{@link https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki 84} accounts from
 * the Blockchain.
 */
export class Discovery {
  //immutable root
  #discovery = {};
  /**
   * Create a discovery object.
   * @param {object} params
   * @param {HDSigner#getExtPub} params.extPubGetter An **async** function that resolves an extended pub key.
   * @param {number} [params.gapAccountLimit=GAP_ACCOUNT_LIMIT] The gap account limit: Number of consecutive unused accounts that can be hit. If the software hits `gapAccountLimit` unused accounts in a row, it expects there are no used accounts beyond this point.
   * @param {number} [params.gapLimit=GAP_LIMIT] The gap limit. See [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#Address_gap_limit).
   * @param {object} params.explorer An instance of {@link Explorer}.
   * @param {number} [params.forceFetchChange=false] Change (also called internal) addresses will not be fetched if external addresses never received any Bitcoin. Can change this behaviour by forcing change addresses to be fetched even if an account never received any Bitcoin.
   * @param {function} [walletChanged] A callback function that will be called
   * everytime a new utxo is added or when the balance in a derivation path
   * changes (anytime `this.#discovery` mutates). The function will receive the this.#discovery object.
   *
   * This function will be triggered as a reaction to new findings when calling
   * {@link Discovery#fetch fetch} or {@link Discovery#fetchUtxos fetchUtxos}.
   */
  constructor(
    {
      extPubGetter,
      gapAccountLimit = GAP_ACCOUNT_LIMIT,
      gapLimit = GAP_LIMIT,
      explorer,
      forceFetchChange = false
    },
    walletChanged
  ) {
    Object.assign(this, {
      walletChanged,
      extPubGetter,
      gapAccountLimit,
      gapLimit,
      explorer,
      forceFetchChange
    });
  }

  /**
   * Get an array of used derivation paths for a certain `extPub`. Note that a
   * derivation path can have no funds but still may have been used in the past.
   *
   * The results produced by this function can be used to compute the next
   * available address in a wallet.
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @param {string} [params.extPub] The extened pub key for which the used derivation paths will be returned. Do not set it in case you want to retrieve all the used derivation paths for all the accounts that can be derived with `this.extPubGetter`.
   * @returns {Array<string>} Returns an array of derivation paths. For example: `["44'/1'/0'/0/2", "44'/1'/0'/0/3"]`
   */
  getUsedDerivationPaths({ network = networks.bitcoin, extPub }) {
    return this.#getAccountsIterable({ network, extPub }).reduce(
      (paths, account) => [...paths, ...Object.keys(account.paths)],
      []
    );
  }
  /**
   * Same as {@link Discovery#getUsedDerivationPaths} but for derivation paths
   * with positive balance. In other words, it returns a subset of the used paths.
   *
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @param {string} [params.extPub] The extened pub key for which the funded derivation paths will be returned. Do not set it in case you want to retrieve all the funded derivation paths for all the accounts that can be derived with `this.extPubGetter`.
   * @returns {Array<string>} Returns an array of derivation paths. For example: `["44'/1'/0'/0/2", "44'/1'/0'/0/3"]`
   */
  getFundedDerivationPaths({ network = networks.bitcoin, extPub }) {
    return this.#getAccountsIterable({ network, extPub }).reduce(
      (paths, account) => [
        ...paths,
        ...Object.values(account.paths)
          .filter(path => path.balance > 0)
          .map(path => path.path)
      ],
      []
    );
  }
  /**
   * Get an array of the network ids stored in an object.
   *
   * You can use `Discovery` to store information for more than one network.
   * This method will return the list of networks that have been discovered.
   * @returns {Array<number>} Returns an array of network Ids. For example: `[BITCOIN, REGTEST, TESTNET]`.
   */
  getNetworkIds() {
    return Object.keys(this.#discovery);
  }
  /**
   * Get an array of accounts for a specific network. In addition to
   * the account's extPub, it also gives back the balance and and whether the
   * account is currently being updated.
   *
   * This function can be used in an App to show the different accounts
   * controlled by the seed.
   *
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @returns {Array<oject>} Returns an array of objects like this: : `[{extPub, balance, pathsBeingFetched, utxosBeingFetched, pathsFetchTime, utxosFetchTime}]`.
   */
  getAccounts({ network }) {
    checkNetwork(network);
    return this.#getAccountsIterable({ network }).map(account => ({
      extPub: account.extPub,
      balance: Object.keys(account.paths).reduce(
        (balance, path) => balance + account.paths[path].balance,
        0
      ),
      pathsBeingFetched: account.pathsBeingFetched,
      utxosBeingFetched: !!account.utxosBeingFetched,
      pathsFetchTime: account.pathsFetchTime,
      utxosFetchTime: account.utxosFetchTime
    }));
  }
  /**
   * Get an array of utxos for a certain `extPub`.
   *
   * The results produced by this function can be used as input to {@link module:coinselect.coinselect coinselect}.
   *
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @param {string} [params.extPub] The extened pub key for which the used derivation paths will be returned. Do not set it in case you want to retrieve all the used derivation paths for all the accounts that can be derived with `this.extPubGetter`.
   * @returns {Array<object>} Returns an array of utxos. For example: `[{tx, n, path},{tx, n, path},...]`
   */
  getUtxos({ network = networks.bitcoin, extPub }) {
    return this.#getAccountsIterable({ network, extPub }).reduce(
      (utxos, account) => [
        ...utxos,
        ...Object.values(account.paths)
          .filter(path => path.balance > 0)
          .map(path => {
            if (typeof path.utxos === 'undefined') {
              throw new Error(
                `Utxos for this account ${account.extPub} have not been retrieved yet!`
              );
            }
            return Object.values(path.utxos).map(utxo => ({
              tx: utxo.tx,
              n: utxo.n,
              path: path.path
            }));
          })
          .reduce(
            (accountUtxos, pathUtxos) => accountUtxos.concat(pathUtxos),
            []
          )
      ],
      []
    );
  }
  /**
   * An `accounts` selector.
   *
   * Select the `accounts` object for a specific network within `discovery`.
   * Run some sanity checks too.
   * @private
   */
  static accountsFromDiscovery({ discovery, network }) {
    checkNetwork(network);
    const networkId = getNetworkId(network);
    if (!discovery[getNetworkId(network)]) {
      throw new Error(`Network ${networkId} not registered.`);
    }
    if (!discovery[getNetworkId(network)].accounts) {
      throw new Error(`Network ${networkId} accounts not created yet.`);
    }
    return discovery[getNetworkId(network)].accounts;
  }
  /**
   * Small utility function that returns an array (an iterable object) of
   * accounts so that it can be used in loops.
   *
   * If extPub is not passed, then it returns an array of accounts
   * for a certain network.
   *
   * If extPub is passed, then it returns an array of length 1 corresponding to
   * the account for that specific extPub in the selected network.
   */
  #getAccountsIterable({ network = networks.bitcoin, extPub }) {
    if (typeof extPub !== 'undefined') checkExtPub({ network, extPub });
    const iterable = Object.values(
      Discovery.accountsFromDiscovery({ discovery: this.#discovery, network })
    );
    return iterable.filter(account =>
      typeof extPub !== 'undefined' ? account.extPub === extPub : true
    );
  }

  /**
   * Queries an online API to get all the addresses that can be derived from
   * an HD wallet using the BIP44 format with purposes: 44, 49 and 84. It
   * returns the addresses that have been used (even if funds are currently
   * zero).
   *
   * The way this function works is as follows:
   *
   * For each LEGACY, NESTED_SEGWIT, NATIVE_SEGWIT purposes:
   *
   * It first checks if account number #0 has ever had any funds (has been used).
   * And it collects both all the addresses (derivation paths) that have been used
   * and the ones that still have funds.
   *
   * Every time that one acount number has been used, then this function tries to
   * get funds from the following account number until it cannot find used
   * accounts.
   *
   * In order to have faster account discovery, this function starts fetching
   * purposes LEGACY, NATIVE_SEGWIT and NESTED_SEGWIT in parallel.
   *
   * In addition, for each purpose, it launches the new account
   * fetching procedure as soon as the previous account fetched is detected to
   * have been used. This allows you to have a parallel lookup of addresses from
   * different accounts.
   *
   * @async
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   *
   */
  async fetch({ network = networks.bitcoin }) {
    checkNetwork(network);
    await Promise.all([
      this.fetchAccount({ network, purpose: LEGACY, recursive: true }),
      this.fetchAccount({ network, purpose: NESTED_SEGWIT, recursive: true }),
      this.fetchAccount({ network, purpose: NATIVE_SEGWIT, recursive: true })
    ]);
  }

  /**
   * Queries an online API to get all the addresses from an account.
   * @async
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @param {number} params.purpose LEGACY, NESTED_SEGWIT, or NATIVE_SEGWIT.
   * @param {number} params.accountNumber The account number as described in {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP44}.
   * @param {number} [params.recursive=false] Fetch the next account as soon as
   * we know this account (`accountNumber`) has been used.
   * @param {number} [params.lastUsedAccountNumber=-1] Only used when
   * `recursive = true`.
   * Which was the last account number used for this `purpose`, that is, which
   * was the last account number where a path has been used.
   * This is used in the stopping condition in combination with
   * `gapAccountLimit` set in the constructor. Set it to
   * `-1` if no accounts have been used yet for this `purpose`.
   *
   */
  async fetchAccount({
    network = networks.bitcoin,
    purpose,
    accountNumber = 0,
    lastUsedAccountNumber = -1,
    recursive = false
  }) {
    const coinType = getNetworkCoinType(network);
    const extPub = await this.extPubGetter({ purpose, accountNumber, network });
    checkExtPub({ extPub, network });

    let pathsBeingFetched = false;
    try {
      //This will fail if the account has not been created yet.
      pathsBeingFetched = this.getAccounts({ network })[extPub]
        .pathsBeingFetched;
    } catch (err) {}
    if (pathsBeingFetched === true) {
      throw new Error(`Account ${extPub} paths were already being updated.`);
    }

    //nextFetcher is launched as soon as we detect accountNumber has been used
    let nextFetcher;

    for (const isChange of [false, true]) {
      if (isChange === true && !nextFetcher && !this.forceFetchChange) {
        //Do not search for change addresses if this account never received
        //any bitcoin. Unless forced.
        break;
      }
      for (
        let index = 0, consecutiveUnusedAddresses = 0;
        consecutiveUnusedAddresses < this.gapLimit;
        index++
      ) {
        const address = getExtPubAddress({ extPub, index, isChange, network });
        const { used, balance } = await this.explorer.fetchAddress(address);
        const path = serializeDerivationPath({
          purpose,
          coinType,
          accountNumber,
          isChange,
          index
        });

        if (balance !== 0 && used === false) {
          throw new Error('Funded address reported as not used');
        }
        if (used === true) {
          this.#pathFound({
            extPub,
            network,
            path,
            balance
          });
          consecutiveUnusedAddresses = 0;
          //If used we can already launch the next account fetcher (in parallel)
          if (!nextFetcher && recursive) {
            nextFetcher = this.fetchAccount({
              network,
              purpose,
              accountNumber: accountNumber + 1,
              lastUsedAccountNumber: accountNumber,
              recursive
            });
          }
        } else {
          consecutiveUnusedAddresses++;
        }
      }
    }
    this.#accountPathsFetched({ extPub, network });
    if (
      !nextFetcher &&
      recursive &&
      accountNumber - lastUsedAccountNumber < this.gapAccountLimit
    ) {
      nextFetcher = this.fetchAccount({
        network,
        purpose,
        accountNumber: accountNumber + 1,
        lastUsedAccountNumber
      });
    }
    //Now wait until the promise for the following account fetched finishes.
    if (nextFetcher) await nextFetcher;
  }

  /**
   * Queries an online API to get the utxos of a certain extPub.
   *
   * @async
   * @param {object} params
   * @param {object} [params.network=networks.bitcoin] A {@link module:networks.networks network}.
   * @param {string} [params.extPub] The extened pub key for which the utxos will be returned. Do not set it in case you want to retrieve all the utxos for all the accounts that can be derived with `this.extPubGetter`.
   */
  async fetchUtxos({ network, extPub }) {
    checkNetwork(network);
    for (const account of this.#getAccountsIterable({ network, extPub })) {
      if (account.utxosBeingFetched === true) {
        throw new Error(
          `Account ${account.extPub} utxos were already being updated.`
        );
      }
      for (const path of Object.values(account.paths)) {
        if (path.balance > 0) {
          const address = await getDerivationPathAddress({
            extPubGetter: this.extPubGetter,
            path: path.path,
            network
          });
          const utxos = await this.explorer.fetchUtxos(address);
          this.#utxosFound({
            utxos,
            network,
            path: path.path,
            extPub: account.extPub
          });
        }
      }
      this.#accountUtxosFetched({ network, extPub: account.extPub });
    }
    //console.log(JSON.stringify(this.#discovery));
  }

  /**
   * Triggered when a path is found.
   *
   * pathFound, accountPathsFetched, utxosFound and accountUtxosFetched are
   * the only functions that are allowed to set this.#discovery.
   * In order to avoid errors, we use immer and force this.#discovery to be
   * immutable.
   */
  #pathFound({ path, balance, extPub, network }) {
    const networkId = getNetworkId(network);
    const newDiscovery = produce(this.#discovery, draftDiscovery => {
      if (!draftDiscovery[networkId]) {
        draftDiscovery[networkId] = { networkId, accounts: {} };
      }
      const accounts = Discovery.accountsFromDiscovery({
        discovery: draftDiscovery,
        network
      });
      if (!accounts[extPub]) {
        accounts[extPub] = { extPub, paths: {} };
      }
      accounts[extPub].pathsBeingFetched = true;
      accounts[extPub].paths[path] = { path, balance };
    });
    if (newDiscovery !== this.#discovery) {
      this.#discovery = newDiscovery;
      if (this.walletChanged) this.walletChanged(this.#discovery);
    }
  }
  /**
   * Triggered when account fetching is finished.
   *
   * pathFound, accountPathsFetched, utxosFound and accountUtxosFetched are
   * the only functions that are allowed to set this.#discovery.
   * In order to avoid errors, we use immer and force this.#discovery to be
   * immutable.
   */
  #accountPathsFetched({ extPub, network }) {
    const networkId = getNetworkId(network);
    //Note that accountPathsFetched will also be called on accounts that have not
    //been used. Only update if this is a used account.
    const newDiscovery = produce(this.#discovery, draftDiscovery => {
      if (!draftDiscovery[networkId]) {
        draftDiscovery[networkId] = { networkId, accounts: {} };
      }
      const accounts = Discovery.accountsFromDiscovery({
        discovery: draftDiscovery,
        network
      });
      if (accounts[extPub]) {
        accounts[extPub].pathsFetchTime = Date.now();
        accounts[extPub].pathsBeingFetched = false;
      }
    });
    if (newDiscovery !== this.#discovery) {
      this.#discovery = newDiscovery;
      if (this.walletChanged) this.walletChanged(this.#discovery);
    }
  }
  /**
   * Triggered when the utxos of a certain path are found
   *
   * pathFound, accountPathsFetched, utxosFound and accountUtxosFetched are
   * the only functions that are allowed to set this.#discovery.
   * In order to avoid errors, we use immer and force this.#discovery to be
   * immutable.
   */
  #utxosFound({ utxos, extPub, path, network }) {
    const newDiscovery = produce(this.#discovery, draftDiscovery => {
      const accounts = Discovery.accountsFromDiscovery({
        discovery: draftDiscovery,
        network
      });
      const _path = accounts[extPub].paths[path];
      const _utxos = (_path.utxos = {});
      let balance = 0;
      utxos.map(utxo => {
        const transaction = Transaction.fromHex(utxo.tx);
        balance += transaction.outs[utxo.n].value;
        const utxoId = transaction.getId().toString() + ':' + utxo.n.toString();
        _utxos[utxoId] = { utxoId, ...utxo };
      });
      //Update the balance with the most recent balance which is the one
      //from the utxos fetched.
      _path.balance = balance;
      accounts[extPub].utxosBeingFetched = true;
    });
    if (newDiscovery !== this.#discovery) {
      this.#discovery = newDiscovery;
      if (this.walletChanged) this.walletChanged(this.#discovery);
    }
  }
  /**
   * Triggered when a utxo is found.
   *
   * pathFound, accountPathsFetched, utxosFound and accountUtxosFetched are
   * the only functions that are allowed to set this.#discovery.
   * In order to avoid errors, we use immer and force this.#discovery to be
   * immutable.
   */
  #accountUtxosFetched({ extPub, network }) {
    const newDiscovery = produce(this.#discovery, draftDiscovery => {
      const accounts = Discovery.accountsFromDiscovery({
        discovery: draftDiscovery,
        network
      });
      accounts[extPub].utxosFetchTime = Date.now();
      accounts[extPub].utxosBeingFetched = false;
    });
    if (newDiscovery !== this.#discovery) {
      this.#discovery = newDiscovery;
      if (this.walletChanged) this.walletChanged(this.#discovery);
    }
  }
}
