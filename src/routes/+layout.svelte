<script lang="ts">
  import { PUBLIC_ENV } from '$env/static/public'
  import Header from '$components/Header.svelte'
  import Footer from '$components/Footer.svelte'
  import '../app.css'
</script>

<svelte:head>
  <title>Sharrr - End-to-end encrypted file transfer.</title>
  <meta
    name="description"
    content="The most secure way to share files online. End-to-end encrypted. One time."
  />
  <meta
    name="keywords"
    content="share file, end-to-end encrypted file sharing, zero knowledge encrypted file transfer, pirates sharrr, arrr, secure file transfer"
  />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="msapplication-TileColor" content="#da532c" />
  <meta name="theme-color" content="#ffffff" />
  {#if PUBLIC_ENV !== 'production'}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>

<div class="app min-h-screen grid grid-flow-row">
  <Header />

  <main class="flex justify-center">
    <slot />
  </main>

  <Footer />
</div>

<style lang="postcss">
  .app {
    grid-template-rows: min-content 1fr min-content;
  }
  :global(html) {
    background-color: theme(colors.gray.100);
    background: radial-gradient(circle, rgb(255 255 255) 0%, rgb(190 199 212) 100%);
    min-height: 100vh;
  }
</style>
