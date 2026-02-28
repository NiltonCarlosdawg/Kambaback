import React, { useState } from 'react';
import api from '../services/api';
import { AuthResponse } from '../types';

interface RegisterProps {
  onRegisterSuccess: (user: any) => void;
  onBackToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onBackToLogin }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    sexo: 'Masculino',
    morada: '',
    senha: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getErrorMessage = (err: any) => {
    const data = err.response?.data;
    if (!data) return 'Erro de conexão ou servidor.';
    
    console.warn('Backend Error Response:', JSON.stringify(data, null, 2));

    if (typeof data.error === 'string') return data.error;
    if (data.error?.mensagemAmigavel) return data.error.mensagemAmigavel;
    if (Array.isArray(data.error?.details)) {
       return data.error.details.map((d: any) => d.mensagem || d.message).join('. ');
    }
    if (data.error?.message) return data.error.message;
    if (data.message) return data.message;

    return 'Erro ao criar conta. Verifica os dados.';
  };

  const calculateAge = (dateString: string) => {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Validar Idade
    if (!formData.dataNascimento) {
      setError('Por favor, insere a data de nascimento.');
      return;
    }
    if (calculateAge(formData.dataNascimento) < 18) {
      setError('Desculpa kamba, precisas de ter pelo menos 18 anos para criar conta.');
      return;
    }

    // 2. Limpar e Validar Telefone
    const cleanPhone = formData.telefone.replace(/\D/g, '');
    
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) {
      setError('O telefone deve ter 9 dígitos e começar por 9 (ex: 923...). Não uses o +244.');
      return;
    }

    // 3. Validar Senha
    if (formData.senha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        dataNascimento: new Date(formData.dataNascimento).toISOString(),
        telefone: cleanPhone,
        sexo: formData.sexo
      };

      console.log('Enviando payload corrigido:', payload);

      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      
      if (data.success) {
        if (data.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          onRegisterSuccess(data.user);
        } else {
          alert('Conta criada com sucesso! Por favor faça login.');
          onBackToLogin();
        }
      }
    } catch (err: any) {
      console.error('Erro no pedido:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden px-4 bg-black text-white font-sans antialiased py-12">
      {/* Top Navigation */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 text-[#cbfb46]">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"></path>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">KambaPro</span>
        </div>
        <div className="hidden md:block">
            <a className="text-sm font-medium text-[#888888] hover:text-white transition-colors" href="#">
              Centro de Ajuda
            </a>
        </div>
      </header>

      {/* Central Register Container */}
      <div className="w-full max-w-[720px] flex flex-col items-center space-y-8 mt-16">
        {/* Back Button */}
        <div className="w-full flex justify-start">
          <button 
            onClick={onBackToLogin}
            className="flex items-center gap-2 text-[#888888] hover:text-[#cbfb46] transition-colors group"
          >
            <svg 
              className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium uppercase tracking-widest">Voltar para o Login</span>
          </button>
        </div>

        {/* Branding Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white">
            Junta-te a Kamba<span className="text-[#cbfb46]">Pro</span>
          </h1>
          <p className="text-[#888888] text-sm font-light tracking-wide">
            Cria a tua conta e começa a tua jornada financeira.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-lg text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Grid Layout for Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome Completo - Full Width */}
            <div className="md:col-span-2 group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Nome Completo
              </label>
              <input
                name="nome"
                type="text"
                required
                minLength={2}
                value={formData.nome}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 text-white placeholder:text-[#888888] focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none"
                placeholder="Nilton Costa"
              />
            </div>

            {/* Email */}
            <div className="group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Endereço de email
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 text-white placeholder:text-[#888888] focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none"
                placeholder="email@exemplo.com"
              />
            </div>

            {/* Telefone */}
            <div className="group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Número de Telefone
              </label>
              <input
                name="telefone"
                type="tel"
                required
                value={formData.telefone}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 text-white placeholder:text-[#888888] focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none"
                placeholder="923 123 456"
              />
              <p className="text-[10px] text-[#888888]/60 mt-1.5 ml-1">Deve ter 9 dígitos e começar por 9 (ex: 923...)</p>
            </div>

            {/* Data de Nascimento */}
            <div className="group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Data de Nascimento
              </label>
              <input
                name="dataNascimento"
                type="date"
                required
                value={formData.dataNascimento}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 text-white placeholder:text-[#888888] focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none [color-scheme:dark]"
              />
              <p className="text-[10px] text-[#888888]/60 mt-1.5 ml-1">Deve ter pelo menos 18 anos</p>
            </div>

            {/* Gênero */}
            <div className="group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Gender
              </label>
              <select
                name="sexo"
                value={formData.sexo}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 text-white focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23888888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 1rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>

            {/* Morada - Full Width */}
            <div className="md:col-span-2 group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Morada
              </label>
              <input
                name="morada"
                type="text"
                required
                minLength={3}
                value={formData.morada}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 text-white placeholder:text-[#888888] focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none"
                placeholder="Luanda, Angola"
              />
            </div>

            {/* Senha - Full Width */}
            <div className="md:col-span-2 group">
              <label className="block text-xs font-medium text-[#888888] mb-2 uppercase tracking-wider">
                Palavra-passe
              </label>
              <div className="relative flex items-center">
                <input
                  name="senha"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.senha}
                  onChange={handleChange}
                  className="w-full bg-[#1a1a1a] border-none rounded-lg h-14 px-5 pr-12 text-white placeholder:text-[#888888] focus:ring-0 focus:shadow-[0_0_0_1px_#cbfb46] transition-all duration-200 outline-none"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-[#888888] hover:text-[#cbfb46] transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {showPassword ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    )}
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-[#888888]/60 mt-1.5 ml-1">At least 8 characters</p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#cbfb46] hover:bg-[#b8e63e] text-black font-bold text-lg h-14 rounded-full transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(203,251,70,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        {/* Secondary Actions */}
        <div className="text-center pt-4">
          <p className="text-[#888888] text-sm">
            Já tens uma conta?
            <button
              onClick={onBackToLogin}
              className="text-white font-semibold hover:text-[#cbfb46] transition-colors ml-1 underline underline-offset-4 decoration-[#cbfb46]/30 hover:decoration-[#cbfb46] focus:outline-none"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center w-full">
        <p className="text-[10px] text-[#888888] uppercase tracking-[0.3em] opacity-40">
          © 2025 KAMBAPRO INTERNATIONAL. ALL RIGHTS RESERVED.
        </p>
      </footer>

      {/* Decorative Elements */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-[#cbfb46]/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#cbfb46]/5 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default Register;