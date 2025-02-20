/**
 * Abstract class for deriving keys from the TEE.
 * You can implement your own logic for deriving keys from the TEE.
 * @example
 * ```ts
 * class MyDeriveKeyProvider extends DeriveKeyProvider {
 *   private client: TappdClient;
 *   
 *   constructor(endpoint: string) {
 *     super();
 *     this.client = new TappdClient();
 *   }
 *   
 *   async rawDeriveKey(path: string, subject: string): Promise<any> {
 *     return this.client.deriveKey(path, subject);
 *   }
 * }
 * ```
 */
export abstract class DeriveKeyProvider {}
export abstract class RemoteAttestationProvider {}