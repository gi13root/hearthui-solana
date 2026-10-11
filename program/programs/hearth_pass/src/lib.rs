//! hearth_pass — on-chain purchase receipts for HearthUI themes.
//! Spec: docs/CONTRACT.md ("Program hearth_pass"). Kept intentionally small.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

// TODO(A3): replace with `anchor keys list` output before devnet deploy (program/DEPLOY.md).
declare_id!("HPass11111111111111111111111111111111111111");

/// USDC devnet mint (decimals 6). Under `--features localnet` a test mint whose
/// keypair seed is public ([7u8; 32]) is used so tests can mint tokens.
#[cfg(not(feature = "localnet"))]
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
#[cfg(feature = "localnet")]
pub const USDC_MINT: Pubkey = pubkey!("GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB");

/// Admin = only signer allowed to create themes; also the treasury wallet (5% fee).
/// TODO(A3): set to the deployer wallet pubkey before devnet deploy.
#[cfg(not(feature = "localnet"))]
pub const ADMIN: Pubkey = pubkey!("2KW2XRd9kwqet15Aha2oK3tYvd3nWbTFH1MBiRAv1BE1");
#[cfg(feature = "localnet")]
pub const ADMIN: Pubkey = pubkey!("2KW2XRd9kwqet15Aha2oK3tYvd3nWbTFH1MBiRAv1BE1"); // seed [8u8; 32]

pub const TREASURY_BPS: u16 = 500;
pub const BPS_DENOM: u64 = 10_000;

#[program]
pub mod hearth_pass {
    use super::*;

    pub fn create_theme(
        ctx: Context<CreateTheme>,
        theme_id: [u8; 32],
        price: u64,
        creator: Pubkey,
    ) -> Result<()> {
        require!(price > 0, HearthError::ZeroPrice);
        require!(theme_id[0] != 0, HearthError::EmptyThemeId);
        let theme = &mut ctx.accounts.theme;
        theme.creator = creator;
        theme.price = price;
        theme.treasury_bps = TREASURY_BPS;
        theme.bump = ctx.bumps.theme;
        Ok(())
    }

    pub fn buy_pass(ctx: Context<BuyPass>, theme_id: [u8; 32]) -> Result<()> {
        let theme = &ctx.accounts.theme;
        let price = theme.price;
        let fee = price
            .checked_mul(theme.treasury_bps as u64)
            .ok_or(HearthError::MathOverflow)?
            / BPS_DENOM;
        let to_creator = price.checked_sub(fee).ok_or(HearthError::MathOverflow)?;
        let decimals = ctx.accounts.mint.decimals;

        let a = &ctx.accounts;
        pay(a, a.creator_ata.to_account_info(), to_creator, decimals)?;
        pay(a, a.treasury_ata.to_account_info(), fee, decimals)?;

        let pass = &mut ctx.accounts.pass;
        pass.buyer = ctx.accounts.buyer.key();
        pass.theme_id = theme_id;
        pass.price = price;
        pass.paid_at = Clock::get()?.unix_timestamp;
        pass.bump = ctx.bumps.pass;
        emit!(PassBought { buyer: pass.buyer, theme_id, price, fee });
        Ok(())
    }
}

fn pay<'info>(a: &BuyPass<'info>, to: AccountInfo<'info>, amount: u64, decimals: u8) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::transfer_checked(
        CpiContext::new(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.buyer_ata.to_account_info(),
                mint: a.mint.to_account_info(),
                to,
                authority: a.buyer.to_account_info(),
            },
        ),
        amount,
        decimals,
    )
}

#[derive(Accounts)]
#[instruction(theme_id: [u8; 32])]
pub struct CreateTheme<'info> {
    #[account(mut, address = ADMIN @ HearthError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Theme::INIT_SPACE,
        seeds = [b"theme", theme_id.as_ref()],
        bump
    )]
    pub theme: Account<'info, Theme>,
    pub system_program: Program<'info, System>,
}

/// Account order is mirrored by program/client/hearth-pass-client.js buildBuyPassInstruction.
#[derive(Accounts)]
#[instruction(theme_id: [u8; 32])]
pub struct BuyPass<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [b"theme", theme_id.as_ref()], bump = theme.bump)]
    pub theme: Account<'info, Theme>,
    /// `init` fails if the receipt already exists => a pass can be bought once.
    #[account(
        init,
        payer = buyer,
        space = 8 + PassReceipt::INIT_SPACE,
        seeds = [b"pass", buyer.key().as_ref(), theme_id.as_ref()],
        bump
    )]
    pub pass: Account<'info, PassReceipt>,
    #[account(address = USDC_MINT @ HearthError::WrongMint)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = theme.creator,
    )]
    pub creator_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = ADMIN,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Theme {
    pub creator: Pubkey,
    pub price: u64,
    pub treasury_bps: u16,
    pub bump: u8,
}

/// Layout (after 8-byte discriminator): buyer 32 | theme_id 32 | price u64 | paid_at i64 | bump u8.
#[account]
#[derive(InitSpace)]
pub struct PassReceipt {
    pub buyer: Pubkey,
    pub theme_id: [u8; 32],
    pub price: u64,
    pub paid_at: i64,
    pub bump: u8,
}

#[event]
pub struct PassBought {
    pub buyer: Pubkey,
    pub theme_id: [u8; 32],
    pub price: u64,
    pub fee: u64,
}

#[error_code]
pub enum HearthError {
    #[msg("Only the admin can create themes")]
    Unauthorized,
    #[msg("Price must be greater than zero")]
    ZeroPrice,
    #[msg("Theme id must not be empty")]
    EmptyThemeId,
    #[msg("Mint must be USDC")]
    WrongMint,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
