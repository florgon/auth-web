import Navbar from './navbar'
import { Container } from 'react-bootstrap'
import Head from 'next/head'

export default function Layout({ children }) {
  return (<>
    <Head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />

      <meta name="author" content={process.env.NEXT_PUBLIC_META_AUTHOR} />
      
      <meta name="description" content="Software solutions for everyone." />
      <meta name="keywords" content="florgon, space, portal, auth, profile, kirillzhosul" />
      
      <link rel="canonical" href={process.env.NEXT_PUBLIC_CANONICAL_DOMAIN} />
      <link rel="alternate" hrefLang="x-default" href={process.env.NEXT_PUBLIC_CANONICAL_DOMAIN} />

      <meta name="title" content="Florgon auth" />
      <title>Auth</title>
    </Head>
    <Navbar />
    <Container className="mt-5 text-center">{children}</Container>
  </>)
}
