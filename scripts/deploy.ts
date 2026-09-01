/**
 * SiteDAO - Sui Move Sözleşme Deploy Script
 * 
 * Kullanım:
 * 1. Sui CLI'ın kurulu olduğundan emin olun
 * 2. `sui client active-address` komutuyla aktif cüzdanınızı kontrol edin
 * 3. `sui client faucet` ile testnet SUI alın
 * 4. Bu scripti çalıştırın: `npx ts-node scripts/deploy.ts`
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Renk kodları için yardımcı fonksiyonlar
const colors = {
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
};

interface DeployResult {
    packageId: string;
    adminCapId: string;
    governanceAdminCapId: string;
    publisherId: string;
    treasuryId: string;
    rentalRegistryId: string;
    proposalRegistryId: string;
}

async function main() {
    console.log(colors.cyan('\n🏗️  SiteDAO - Sui Move Sözleşme Deploy Başlatılıyor...\n'));

    const movePath = path.join(__dirname, '..', 'move', 'site_dao');

    // 1. Sui CLI kontrolü
    console.log(colors.yellow('📋 Sui CLI kontrol ediliyor...'));
    try {
        const version = execSync('sui --version', { encoding: 'utf-8' });
        console.log(colors.green(`✅ Sui CLI bulundu: ${version.trim()}`));
    } catch {
        console.error(colors.red('❌ Sui CLI bulunamadı. Lütfen https://docs.sui.io/build/install adresinden kurun.'));
        process.exit(1);
    }

    // 2. Aktif adres kontrolü
    console.log(colors.yellow('\n📋 Aktif cüzdan kontrol ediliyor...'));
    try {
        const activeAddress = execSync('sui client active-address', { encoding: 'utf-8' }).trim();
        console.log(colors.green(`✅ Aktif adres: ${activeAddress}`));
    } catch {
        console.error(colors.red('❌ Aktif cüzdan bulunamadı. `sui client active-address` komutuyla kontrol edin.'));
        process.exit(1);
    }

    // 3. Ağ kontrolü
    console.log(colors.yellow('\n📋 Aktif ağ kontrol ediliyor...'));
    try {
        const activeEnv = execSync('sui client active-env', { encoding: 'utf-8' }).trim();
        console.log(colors.green(`✅ Aktif ağ: ${activeEnv}`));
        
        if (!activeEnv.includes('testnet') && !activeEnv.includes('devnet')) {
            console.log(colors.yellow('⚠️  Uyarı: Mainnet üzerinde deploy yapıyorsunuz!'));
        }
    } catch {
        console.log(colors.yellow('⚠️  Ağ bilgisi alınamadı, devam ediliyor...'));
    }

    // 4. Move sözleşmelerini derle
    console.log(colors.yellow('\n📦 Move sözleşmeleri derleniyor...'));
    try {
        execSync(`sui move build`, { 
            cwd: movePath,
            encoding: 'utf-8',
            stdio: 'inherit'
        });
        console.log(colors.green('✅ Derleme başarılı!'));
    } catch {
        console.error(colors.red('❌ Derleme hatası!'));
        process.exit(1);
    }

    // 5. Deploy et
    console.log(colors.yellow('\n🚀 Sözleşmeler deploy ediliyor...'));
    try {
        const deployOutput = execSync(`sui client publish --gas-budget 200000000 --json`, {
            cwd: movePath,
            encoding: 'utf-8'
        });

        const deployResult = JSON.parse(deployOutput);
        
        if (deployResult.effects?.status?.status !== 'success') {
            console.error(colors.red('❌ Deploy başarısız!'));
            console.error(deployResult.effects?.status);
            process.exit(1);
        }

        // Created objects'ları analiz et
        const createdObjects = deployResult.effects?.created || [];
        const publishedPackage = deployResult.objectChanges?.find(
            (change: any) => change.type === 'published'
        );

        const result: Partial<DeployResult> = {
            packageId: publishedPackage?.packageId || ''
        };

        // Object tiplerini eşleştir
        for (const obj of createdObjects) {
            const objType = obj.owner?.Shared ? 'shared' : 'owned';
            const objectId = obj.reference?.objectId;
            
            // objectChanges'dan type bilgisini al
            const objChange = deployResult.objectChanges?.find(
                (change: any) => change.objectId === objectId
            );
            const type = objChange?.objectType || '';

            if (type.includes('AdminCap') && !type.includes('Governance')) {
                result.adminCapId = objectId;
            } else if (type.includes('GovernanceAdminCap')) {
                result.governanceAdminCapId = objectId;
            } else if (type.includes('Treasury')) {
                result.treasuryId = objectId;
            } else if (type.includes('RentalRegistry')) {
                result.rentalRegistryId = objectId;
            } else if (type.includes('ProposalRegistry')) {
                result.proposalRegistryId = objectId;
            } else if (type.includes('package::Publisher')) {
                result.publisherId = objectId;
            }
        }

        console.log(colors.green('\n✅ Deploy başarılı!\n'));
        console.log(colors.cyan('📦 Deploy Sonuçları:'));
        console.log(colors.blue('─'.repeat(60)));
        console.log(`Package ID:           ${colors.green(result.packageId || 'N/A')}`);
        console.log(`AdminCap ID:          ${colors.green(result.adminCapId || 'N/A')}`);
        console.log(`GovernanceAdminCap:   ${colors.green(result.governanceAdminCapId || 'N/A')}`);
        console.log(`Treasury ID:          ${colors.green(result.treasuryId || 'N/A')}`);
        console.log(`RentalRegistry ID:    ${colors.green(result.rentalRegistryId || 'N/A')}`);
        console.log(`ProposalRegistry ID:  ${colors.green(result.proposalRegistryId || 'N/A')}`);
        console.log(`Publisher ID:         ${colors.green(result.publisherId || 'N/A')}`);
        console.log(colors.blue('─'.repeat(60)));

        // Kiraya cikarma daireyi Kiosk'a kilitler; bunun icin Apartment tipine ait
        // bir TransferPolicy bir kez olusturulmalidir.
        console.log(colors.cyan(''));
        console.log(colors.cyan('Apartment TransferPolicy bir kez olusturulmali:'));
        console.log(colors.blue(`   sui client call --package ${result.packageId} --module apartment --function create_transfer_policy --args ${result.publisherId || '<PUBLISHER_ID>'} --gas-budget 20000000`));
        console.log(colors.cyan('Olusan TransferPolicy nesnesinin ID sini .env.local icinde'));
        console.log(colors.cyan('NEXT_PUBLIC_APARTMENT_POLICY_ID olarak tanimlayin.'));

        // Sonuçları dosyaya kaydet
        const outputPath = path.join(__dirname, '..', 'deployed-contracts.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(colors.green(`\n💾 Sonuçlar kaydedildi: ${outputPath}`));

        // Frontend için .env.local dosyasını güncelle
        // Sadece deploy'un ürettiği anahtarlar yazılır; Pinata/Google gibi
        // elle girilmiş değerler korunur.
        const managedEnv: Record<string, string | undefined> = {
            NEXT_PUBLIC_PACKAGE_ID: result.packageId,
            NEXT_PUBLIC_TREASURY_ID: result.treasuryId,
            NEXT_PUBLIC_RENTAL_REGISTRY_ID: result.rentalRegistryId,
            NEXT_PUBLIC_PROPOSAL_REGISTRY_ID: result.proposalRegistryId,
            NEXT_PUBLIC_GOVERNANCE_ADMIN_CAP_ID: result.governanceAdminCapId,
            NEXT_PUBLIC_NETWORK: 'testnet',
        };

        const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
        fs.mkdirSync(path.dirname(envPath), { recursive: true });

        const existingLines = fs.existsSync(envPath)
            ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
            : [];

        // Deploy'un yönettiği anahtarları eski dosyadan çıkar, gerisini olduğu gibi bırak
        const preserved = existingLines.filter((line) => {
            const key = line.split('=')[0].trim();
            return !(key in managedEnv);
        });

        const generated = ['# SiteDAO Contract Addresses (deploy.ts tarafından üretildi)']
            .concat(Object.entries(managedEnv).map(([k, v]) => `${k}=${v || ''}`));

        const envContent = generated.concat(preserved).join('\n').trimEnd() + '\n';
        fs.writeFileSync(envPath, envContent);
        console.log(colors.green(`💾 Frontend .env.local güncellendi: ${envPath}`));

    } catch (error: any) {
        console.error(colors.red('❌ Deploy hatası!'));
        console.error(error.message);
        process.exit(1);
    }

    console.log(colors.cyan('\n🎉 SiteDAO başarıyla deploy edildi!\n'));
}

main().catch(console.error);
