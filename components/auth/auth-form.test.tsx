import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './auth-form';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ login: mocks.login, register: mocks.register }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.register.mockResolvedValue(undefined);
  mocks.login.mockResolvedValue(undefined);
});

function fillRegisterForm(container: HTMLElement) {
  fireEvent.change(container.querySelector('input[name="first_name"]')!, { target: { value: 'Alice' } });
  fireEvent.change(container.querySelector('input[name="last_name"]')!, { target: { value: 'Engineer' } });
  fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'alice@example.com' } });
  fireEvent.change(container.querySelector('input[name="password"]')!, { target: { value: 'super-secret-1' } });
}

describe('AuthForm', () => {
  it('renders a password field in register mode', () => {
    const { container } = render(<AuthForm mode="register" />);
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.querySelector('input[name="first_name"]')).not.toBeNull();
  });

  it('renders a password field in login mode', () => {
    const { container } = render(<AuthForm mode="login" />);
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });

  it('submits the typed credentials and navigates to the dashboard', async () => {
    const { container } = render(<AuthForm mode="register" />);
    fillRegisterForm(container);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.register).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'super-secret-1',
      first_name: 'Alice',
      last_name: 'Engineer',
    });
  });

  it('ignores a second submit while the first is in flight', async () => {
    let resolveRegister: () => void = () => undefined;
    mocks.register.mockImplementation(() => new Promise<void>((resolve) => { resolveRegister = resolve; }));

    const { container } = render(<AuthForm mode="register" />);
    fillRegisterForm(container);
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    resolveRegister();

    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
  });

  it('shows the error message when registration fails', async () => {
    mocks.register.mockRejectedValue(new Error('Email is already registered'));
    const { container } = render(<AuthForm mode="register" />);
    fillRegisterForm(container);
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('Email is already registered')).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
