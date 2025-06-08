import VideoStream from './components/VideoStream';

export default function App () {
  return (
    <div className='flex justify-center flex-col gap-5 items-center h-screen bg-gray-100'>
      <h1 style={{ textAlign: 'center' }}>Real-Time Violence Detection</h1>
      <VideoStream />
    </div>
  );
}