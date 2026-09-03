import React from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="pt-20">
      <EmptyState
        mood="carry"
        title="Essa página não existe"
        body="Mas a fogueira está acesa lá na home."
        action={<Link to="/"><Button>Voltar para casa</Button></Link>}
      />
    </div>
  );
}
