import React from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="pt-20">
      <EmptyState
        mood="carry"
        title="This page does not exist"
        body="But the campfire is still lit back home."
        action={<Link to="/"><Button>Back home</Button></Link>}
      />
    </div>
  );
}
